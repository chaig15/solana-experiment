import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

class SolanaTokenTracker {
  private connection: Connection;
  private readonly TOKEN_PROGRAM =
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  private readonly TOKEN_METADATA_PROGRAM_ID =
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
  private tokenList: Map<string, TokenMetadata>;

  constructor() {
    this.connection = new Connection(clusterApiUrl("mainnet-beta"));
    this.tokenList = new Map();
  }

  async loadTokenList() {
    try {
      const response = await fetch(
        "https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json"
      );
      const data = await response.json();

      data.tokens.forEach((token: any) => {
        this.tokenList.set(token.address, {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
        });
      });
    } catch (error) {
      console.error("Error loading token list:", error);
    }
  }

  async getMetadata(tokenMint: string): Promise<TokenMetadata | null> {
    try {
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey(this.TOKEN_METADATA_PROGRAM_ID).toBuffer(),
          new PublicKey(tokenMint).toBuffer(),
        ],
        new PublicKey(this.TOKEN_METADATA_PROGRAM_ID)
      );

      const accountInfo = await this.connection.getAccountInfo(metadataAddress);

      if (!accountInfo) {
        return null;
      }

      // Skip the first byte (metadata version)
      let offset = 1;

      // Skip update authority (32 bytes)
      offset += 32;

      // Skip mint address (32 bytes)
      offset += 32;

      // Name length and name
      const nameLength = accountInfo.data[offset];
      offset += 1;
      const name = accountInfo.data
        .slice(offset, offset + nameLength)
        .toString();
      offset += nameLength;

      // Symbol length and symbol
      const symbolLength = accountInfo.data[offset];
      offset += 1;
      const symbol = accountInfo.data
        .slice(offset, offset + symbolLength)
        .toString();
      offset += symbolLength;

      return {
        name,
        symbol,
        decimals: 6, // Most Solana tokens use 6 decimals
      };
    } catch (error) {
      console.error("Error fetching metadata:", error);
      return null;
    }
  }

  async getTokenBalances(walletAddress: string) {
    try {
      if (this.tokenList.size === 0) {
        await this.loadTokenList();
      }

      const wallet = new PublicKey(walletAddress);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        wallet,
        {
          programId: new PublicKey(this.TOKEN_PROGRAM),
        }
      );

      const balances = await Promise.all(
        tokenAccounts.value.map(async (account) => {
          const parsedInfo = account.account.data.parsed.info;
          const tokenMint = parsedInfo.mint;

          // Try getting metadata from token list first
          let metadata = this.tokenList.get(tokenMint);

          // If not in token list, try getting on-chain metadata
          if (!metadata) {
            const onChainMetadata = await this.getMetadata(tokenMint);
            if (onChainMetadata) {
              metadata = onChainMetadata;
            } else if (tokenMint.toLowerCase().endsWith("pump")) {
              // Special handling for Pump tokens
              metadata = {
                name: "Pump Protocol LP Token",
                symbol: "PUMP-LP",
                decimals: 6,
              };
            } else {
              // Fallback for unknown tokens
              metadata = {
                name: "Unknown Token",
                symbol: "UNKNOWN",
                decimals: parsedInfo.tokenAmount.decimals,
              };
            }
          }

          return {
            mint: tokenMint,
            balance: parsedInfo.tokenAmount.uiAmount,
            ...metadata,
          };
        })
      );

      return balances.filter((balance) => balance.balance > 0);
    } catch (error) {
      console.error("Error getting token balances:", error);
      throw error;
    }
  }
}

// Usage example
async function main() {
  const tracker = new SolanaTokenTracker();
  const walletAddress = "2TT5RNFhvwKxpyB9PkihbA9gYZJMHJKfvs93rLpamvE3";

  try {
    const balances = await tracker.getTokenBalances(walletAddress);
    console.log("Token Balances:");
    balances.forEach((balance) => {
      console.log(`${balance.name} (${balance.symbol}): ${balance.balance}`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

if (require.main === module) {
  main();
}

export { SolanaTokenTracker };

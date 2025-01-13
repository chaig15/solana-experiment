import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

async function main() {
  // Connect to the devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"));

  // Get a sample account to query
  const account = new PublicKey("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg");

  try {
    const balance = await connection.getBalance(account);
    console.log(`Account balance: ${balance / 10 ** 9} SOL`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();

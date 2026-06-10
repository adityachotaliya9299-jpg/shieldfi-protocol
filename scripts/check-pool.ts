import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const PROGRAM_ID = new PublicKey("3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM");
  const mint = new PublicKey("8obTjPgdsg912JaVFTndfnFETL6yFKtfwVPhx8Ci8za5");

  const [poolPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mint.toBuffer()], PROGRAM_ID
  );

  const acc = await conn.getAccountInfo(poolPDA);
  console.log("Pool PDA:", poolPDA.toBase58());
  console.log("Pool exists:", !!acc);
  console.log("Account size:", acc?.data.length, "bytes");
  console.log("Expected LEN:", 251, "bytes");
}
main().catch(console.error);

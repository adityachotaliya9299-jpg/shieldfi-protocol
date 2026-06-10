import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM");
export const USDC_MINT = new PublicKey("8obTjPgdsg912JaVFTndfnFETL6yFKtfwVPhx8Ci8za5");
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

export function getPoolPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("pool"), tokenMint.toBuffer()], PROGRAM_ID);
}
export function getVaultPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), tokenMint.toBuffer()], PROGRAM_ID);
}
export function getPositionPDA(pool: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("position"), pool.toBuffer(), user.toBuffer()], PROGRAM_ID);
}
export function formatAmount(lamports: bigint | number, decimals = 6): string {
  const amount = Number(lamports) / Math.pow(10, decimals);
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
export function getHealthColor(health: number): string {
  if (health > 15000) return "text-green-400";
  if (health > 12000) return "text-yellow-400";
  return "text-red-400";
}

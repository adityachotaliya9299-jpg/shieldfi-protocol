import { PublicKey } from "@solana/web3.js";

// Your deployed program ID (replace after anchor deploy)
export const PROGRAM_ID = new PublicKey(
  "GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun"
);

// Devnet USDC mint (Circle's devnet USDC)
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// Pyth devnet price feed for USDC/USD
export const USDC_PYTH_FEED = new PublicKey(
  "5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7"
);

export const RPC_ENDPOINT = "https://api.devnet.solana.com";

// Derive pool PDA
export function getPoolPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

// Derive vault PDA
export function getVaultPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

// Derive user position PDA
export function getPositionPDA(
  pool: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

// Format token amounts (assumes 6 decimals like USDC)
export function formatAmount(lamports: bigint | number, decimals = 6): string {
  const amount = Number(lamports) / Math.pow(10, decimals);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

// Health factor color
export function getHealthColor(health: number): string {
  if (health > 15000) return "text-green-400";
  if (health > 12000) return "text-yellow-400";
  return "text-red-400";
}

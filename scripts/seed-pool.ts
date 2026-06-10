import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM");
const MINT = new PublicKey("8obTjPgdsg912JaVFTndfnFETL6yFKtfwVPhx8Ci8za5");

const IDL = {
  version: "0.1.0", name: "shieldfi",
  metadata: { address: "3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM" },
  instructions: [{
    name: "deposit",
    accounts: [
      { name: "user", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "userPosition", isMut: true, isSigner: false },
      { name: "userTokenAccount", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
      { name: "rent", isMut: false, isSigner: false },
    ],
    args: [{ name: "amount", type: "u64" }]
  }],
  accounts: [{
    name: "LendingPool",
    type: { kind: "struct", fields: [
      { name: "authority", type: "publicKey" },
      { name: "pendingAuthority", type: "publicKey" },
      { name: "tokenMint", type: "publicKey" },
      { name: "tokenVault", type: "publicKey" },
      { name: "oracle", type: "publicKey" },
      { name: "totalDeposits", type: "u64" },
      { name: "totalBorrows", type: "u64" },
      { name: "reserveFactor", type: "u64" },
      { name: "collateralFactor", type: "u64" },
      { name: "liquidationThreshold", type: "u64" },
      { name: "liquidationBonus", type: "u64" },
      { name: "withdrawalLimitBps", type: "u64" },
      { name: "rateLimitSlot", type: "u64" },
      { name: "withdrawnThisSlot", type: "u64" },
      { name: "borrowRateBps", type: "u64" },
      { name: "treasuryAccumulated", type: "u64" },
      { name: "isPaused", type: "bool" },
      { name: "bump", type: "u8" },
    ]}
  }],
  types: [], errors: [],
} as const;

async function main() {
  const conn = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as any, PROGRAM_ID, provider);

  const [poolPDA] = PublicKey.findProgramAddressSync([Buffer.from("pool"), MINT.toBuffer()], PROGRAM_ID);
  const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("vault"), MINT.toBuffer()], PROGRAM_ID);
  const [positionPDA] = PublicKey.findProgramAddressSync([Buffer.from("position"), poolPDA.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM_ID);

  const authATA = await getOrCreateAssociatedTokenAccount(conn, wallet.payer, MINT, wallet.publicKey);
  console.log("Auth ATA balance:", authATA.amount.toString());

  console.log("Seeding pool with 5,000 USDC...");
  await (program.methods as any).deposit(new BN(5_000 * 10**6)).accounts({
    user: wallet.publicKey, tokenMint: MINT,
    pool: poolPDA, userPosition: positionPDA,
    userTokenAccount: authATA.address, tokenVault: vaultPDA,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  }).rpc();

  const pool = await (program.account as any).lendingPool.fetch(poolPDA);
  console.log("\n✅ Pool seeded!");
  console.log("Total deposits:", pool.totalDeposits.toNumber() / 10**6, "USDC");
  console.log("Borrow rate:", pool.borrowRateBps.toNumber(), "bps APY");
  console.log("Treasury:", pool.treasuryAccumulated.toNumber(), "tokens");
  console.log("Pool PDA:", poolPDA.toBase58());
  console.log("\n📋 USDC_MINT =", MINT.toBase58());
}
main().catch(console.error);

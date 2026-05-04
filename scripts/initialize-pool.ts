import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM");

const IDL = {
  version: "0.1.0",
  name: "shieldfi",
  metadata: { address: "3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM" },
  instructions: [
    { name: "initializePool", accounts: [
      { name: "authority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
      { name: "rent", isMut: false, isSigner: false },
    ], args: [{ name: "config", type: { defined: "PoolConfig" } }] },
    { name: "deposit", accounts: [
      { name: "user", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "userPosition", isMut: true, isSigner: false },
      { name: "userTokenAccount", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
      { name: "rent", isMut: false, isSigner: false },
    ], args: [{ name: "amount", type: "u64" }] },
  ],
  accounts: [
    { name: "LendingPool", type: { kind: "struct", fields: [
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
      { name: "isPaused", type: "bool" },
      { name: "bump", type: "u8" },
    ]}},
  ],
  types: [
    { name: "PoolConfig", type: { kind: "struct", fields: [
      { name: "reserveFactor", type: "u64" },
      { name: "collateralFactor", type: "u64" },
      { name: "liquidationThreshold", type: "u64" },
      { name: "liquidationBonus", type: "u64" },
      { name: "oracle", type: "publicKey" },
    ]}},
  ],
  errors: [],
} as const;

async function main() {
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as any, PROGRAM_ID, provider);

  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("Program:", PROGRAM_ID.toBase58());

  console.log("\n1. Creating demo USDC mint...");
  const tokenMint = await createMint(connection, wallet.payer, wallet.publicKey, null, 6);
  console.log("   Token mint:", tokenMint.toBase58());

  const [poolPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenMint.toBuffer()], PROGRAM_ID
  );
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), tokenMint.toBuffer()], PROGRAM_ID
  );
  const [positionPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), poolPDA.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM_ID
  );

  console.log("   Pool PDA:", poolPDA.toBase58());

  console.log("\n2. Initializing lending pool...");
  const ORACLE = new PublicKey("11111111111111111111111111111111");

  await (program.methods as any).initializePool({
    reserveFactor: new BN(1000),
    collateralFactor: new BN(7500),
    liquidationThreshold: new BN(8000),
    liquidationBonus: new BN(500),
    oracle: ORACLE,
  }).accounts({
    authority: wallet.publicKey,
    tokenMint,
    pool: poolPDA,
    tokenVault: vaultPDA,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  }).rpc();

  console.log("   Pool initialized!");

  console.log("\n3. Minting 10,000 demo USDC...");
  const authATA = await getOrCreateAssociatedTokenAccount(
    connection, wallet.payer, tokenMint, wallet.publicKey
  );
  await mintTo(connection, wallet.payer, tokenMint, authATA.address, wallet.payer, 10_000 * 10**6);

  console.log("\n4. Seeding pool with 5,000 USDC...");
  await (program.methods as any).deposit(new BN(5_000 * 10**6)).accounts({
    user: wallet.publicKey,
    tokenMint,
    pool: poolPDA,
    userPosition: positionPDA,
    userTokenAccount: authATA.address,
    tokenVault: vaultPDA,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  }).rpc();

  const pool = await (program.account as any).lendingPool.fetch(poolPDA);

  console.log("\n✅ SUCCESS!");
  console.log("=====================================");
  console.log("Token Mint:    ", tokenMint.toBase58());
  console.log("Pool PDA:      ", poolPDA.toBase58());
  console.log("Total Deposits:", pool.totalDeposits.toNumber() / 10**6, "USDC");
  console.log("=====================================");
  console.log("\n📋 COPY THESE TO app/lib/constants.ts:");
  console.log(`PROGRAM_ID = "3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM"`);
  console.log(`USDC_MINT  = "${tokenMint.toBase58()}"`);
}

main().catch(console.error);

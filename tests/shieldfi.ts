import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  SystemProgram as SP,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const PID = "GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun";

const IDL = {
  version: "0.1.0",
  name: "shieldfi",
  metadata: { address: PID },
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
    { name: "withdraw", accounts: [
      { name: "user", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "userPosition", isMut: true, isSigner: false },
      { name: "userTokenAccount", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
    ], args: [{ name: "amount", type: "u64" }] },
    { name: "borrow", accounts: [
      { name: "user", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "userPosition", isMut: true, isSigner: false },
      { name: "userTokenAccount", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
    ], args: [{ name: "amount", type: "u64" }] },
    { name: "repay", accounts: [
      { name: "user", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
      { name: "userPosition", isMut: true, isSigner: false },
      { name: "userTokenAccount", isMut: true, isSigner: false },
      { name: "tokenVault", isMut: true, isSigner: false },
      { name: "tokenProgram", isMut: false, isSigner: false },
      { name: "systemProgram", isMut: false, isSigner: false },
    ], args: [{ name: "amount", type: "u64" }] },
    { name: "pauseProtocol", accounts: [
      { name: "authority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
    ], args: [] },
    { name: "resumeProtocol", accounts: [
      { name: "authority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
    ], args: [] },
    { name: "updatePoolConfig", accounts: [
      { name: "authority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
    ], args: [{ name: "config", type: { defined: "PoolConfig" } }] },
    { name: "nominateAuthority", accounts: [
      { name: "authority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
    ], args: [{ name: "newAuthority", type: "publicKey" }] },
    { name: "acceptAuthority", accounts: [
      { name: "newAuthority", isMut: true, isSigner: true },
      { name: "tokenMint", isMut: false, isSigner: false },
      { name: "pool", isMut: true, isSigner: false },
    ], args: [] },
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
    { name: "UserPosition", type: { kind: "struct", fields: [
      { name: "owner", type: "publicKey" },
      { name: "pool", type: "publicKey" },
      { name: "depositedAmount", type: "u64" },
      { name: "borrowedAmount", type: "u64" },
      { name: "lastUpdateSlot", type: "u64" },
      { name: "accruedInterest", type: "u64" },
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

function poolPDA(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mint.toBuffer()],
    new PublicKey(PID)
  );
}
function vaultPDA(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    new PublicKey(PID)
  );
}
function positionPDA(pool: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    new PublicKey(PID)
  );
}

describe("ShieldFi Protocol", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as any, PID, provider);
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let pool: PublicKey;
  let vault: PublicKey;
  let authATA: PublicKey;
  let user: Keypair;
  let userATA: PublicKey;
  let userPos: PublicKey;
  let authPos: PublicKey;

  const D = 6;
  const ORACLE = new PublicKey("11111111111111111111111111111111");
  const cfg = {
    reserveFactor: new BN(1000),
    collateralFactor: new BN(7500),
    liquidationThreshold: new BN(8000),
    liquidationBonus: new BN(500),
    oracle: ORACLE,
  };

  // Transfer SOL from authority to a new keypair (avoids devnet airdrop rate limit)
  async function fundKeypair(kp: Keypair, lamports: number) {
    const tx = new Transaction().add(
      SP.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: kp.publicKey,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  }

  before(async () => {
    console.log("\n  Setting up...");

    mint = await createMint(
      connection, authority.payer, authority.publicKey, null, D
    );
    [pool] = poolPDA(mint);
    [vault] = vaultPDA(mint);

    authATA = await createAccount(
      connection, authority.payer, mint, authority.publicKey
    );
    await mintTo(
      connection, authority.payer, mint,
      authATA, authority.payer, 1000 * 10**D
    );

    user = Keypair.generate();

    // Fund user from authority wallet instead of airdrop
    await fundKeypair(user, 0.5 * LAMPORTS_PER_SOL);

    userATA = await createAccount(connection, user, mint, user.publicKey);
    await mintTo(
      connection, authority.payer, mint,
      userATA, authority.payer, 500 * 10**D
    );

    [userPos] = positionPDA(pool, user.publicKey);
    [authPos] = positionPDA(pool, authority.publicKey);
    console.log("  Ready.\n");
  });

  it("1. initializes pool", async () => {
    await (program.methods as any).initializePool(cfg).accounts({
      authority: authority.publicKey, tokenMint: mint,
      pool, tokenVault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    }).rpc();

    const p = await (program.account as any).lendingPool.fetch(pool);
    assert.equal(p.collateralFactor.toNumber(), 7500);
    assert.isFalse(p.isPaused);
    console.log("  ✅ Pool initialized");
  });

  it("2. deposits collateral", async () => {
    const amt = new BN(100 * 10**D);
    await (program.methods as any).deposit(amt).accounts({
      user: user.publicKey, tokenMint: mint,
      pool, userPosition: userPos, userTokenAccount: userATA,
      tokenVault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    }).signers([user]).rpc();

    const p = await (program.account as any).lendingPool.fetch(pool);
    assert.equal(p.totalDeposits.toNumber(), amt.toNumber());
    console.log("  ✅ Deposited 100 USDC");
  });

  it("3. rejects zero deposit", async () => {
    try {
      await (program.methods as any).deposit(new BN(0)).accounts({
        user: user.publicKey, tokenMint: mint,
        pool, userPosition: userPos, userTokenAccount: userATA,
        tokenVault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      }).signers([user]).rpc();
      assert.fail();
    } catch(e: any) { assert.include(e.toString(), "ZeroAmount"); }
    console.log("  ✅ Zero amount guard works");
  });

  it("4. borrows within limit", async () => {
    await (program.methods as any).deposit(new BN(100 * 10**D)).accounts({
      user: authority.publicKey, tokenMint: mint,
      pool, userPosition: authPos, userTokenAccount: authATA,
      tokenVault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    }).rpc();

    const borrow = new BN(50 * 10**D);
    await (program.methods as any).borrow(borrow).accounts({
      user: user.publicKey, tokenMint: mint,
      pool, userPosition: userPos, userTokenAccount: userATA,
      tokenVault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();

    const pos = await (program.account as any).userPosition.fetch(userPos);
    assert.equal(pos.borrowedAmount.toNumber(), borrow.toNumber());
    console.log("  ✅ Borrowed 50 USDC");
  });

  it("5. rejects over-borrow", async () => {
    try {
      await (program.methods as any).borrow(new BN(50 * 10**D)).accounts({
        user: user.publicKey, tokenMint: mint,
        pool, userPosition: userPos, userTokenAccount: userATA,
        tokenVault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([user]).rpc();
      assert.fail();
    } catch(e: any) { assert.include(e.toString(), "InsufficientCollateral"); }
    console.log("  ✅ Over-borrow rejected");
  });

  it("6. repays debt", async () => {
    const repay = new BN(25 * 10**D);
    const before = await (program.account as any).userPosition.fetch(userPos);

    await (program.methods as any).repay(repay).accounts({
      user: user.publicKey, tokenMint: mint,
      pool, userPosition: userPos, userTokenAccount: userATA,
      tokenVault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();

    const after = await (program.account as any).userPosition.fetch(userPos);
    assert.equal(
      after.borrowedAmount.toNumber(),
      before.borrowedAmount.toNumber() - repay.toNumber()
    );
    console.log("  ✅ Repaid 25 USDC");
  });

  it("7. pause blocks deposits + resume re-enables", async () => {
    await (program.methods as any).pauseProtocol()
      .accounts({ authority: authority.publicKey, tokenMint: mint, pool }).rpc();

    const paused = await (program.account as any).lendingPool.fetch(pool);
    assert.isTrue(paused.isPaused);

    try {
      await (program.methods as any).deposit(new BN(1_000_000)).accounts({
        user: user.publicKey, tokenMint: mint,
        pool, userPosition: userPos, userTokenAccount: userATA,
        tokenVault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      }).signers([user]).rpc();
      assert.fail();
    } catch(e: any) { assert.include(e.toString(), "ProtocolPaused"); }

    await (program.methods as any).resumeProtocol()
      .accounts({ authority: authority.publicKey, tokenMint: mint, pool }).rpc();

    const resumed = await (program.account as any).lendingPool.fetch(pool);
    assert.isFalse(resumed.isPaused);
    console.log("  ✅ Circuit breaker works");
  });

  it("8. rejects unauthorized pause", async () => {
    try {
      await (program.methods as any).pauseProtocol()
        .accounts({ authority: user.publicKey, tokenMint: mint, pool })
        .signers([user]).rpc();
      assert.fail();
    } catch(e: any) { assert.include(e.toString(), "Unauthorized"); }
    console.log("  ✅ Unauthorized pause rejected");
  });

  it("9. updates pool config", async () => {
    await (program.methods as any).updatePoolConfig({
      reserveFactor: new BN(500),
      collateralFactor: new BN(7000),
      liquidationThreshold: new BN(7500),
      liquidationBonus: new BN(800),
      oracle: ORACLE,
    }).accounts({ authority: authority.publicKey, tokenMint: mint, pool }).rpc();

    const p = await (program.account as any).lendingPool.fetch(pool);
    assert.equal(p.collateralFactor.toNumber(), 7000);
    console.log("  ✅ Config updated");
  });

  it("10. two-step authority transfer", async () => {
    const newAuth = Keypair.generate();
    await fundKeypair(newAuth, 0.3 * LAMPORTS_PER_SOL);

    await (program.methods as any).nominateAuthority(newAuth.publicKey)
      .accounts({ authority: authority.publicKey, tokenMint: mint, pool }).rpc();

    const nominated = await (program.account as any).lendingPool.fetch(pool);
    assert.ok(nominated.pendingAuthority.equals(newAuth.publicKey));
    assert.ok(nominated.authority.equals(authority.publicKey));

    await (program.methods as any).acceptAuthority()
      .accounts({ newAuthority: newAuth.publicKey, tokenMint: mint, pool })
      .signers([newAuth]).rpc();

    const transferred = await (program.account as any).lendingPool.fetch(pool);
    assert.ok(transferred.authority.equals(newAuth.publicKey));

    // Transfer back to original
    await (program.methods as any).nominateAuthority(authority.publicKey)
      .accounts({ authority: newAuth.publicKey, tokenMint: mint, pool })
      .signers([newAuth]).rpc();
    await (program.methods as any).acceptAuthority()
      .accounts({ newAuthority: authority.publicKey, tokenMint: mint, pool })
      .rpc();

    console.log("  ✅ Two-step authority transfer works");
  });

  after(() => {
    console.log("\n  ══════════════════════════════════");
    console.log("  All 10 ShieldFi tests complete! 🏆");
    console.log("  ══════════════════════════════════");
  });
});

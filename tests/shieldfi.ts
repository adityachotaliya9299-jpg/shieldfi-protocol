import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun");

// Minimal IDL with address embedded — Anchor 0.29 requirement
const IDL = {
  version: "0.1.0",
  name: "shieldfi",
  metadata: { address: "GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun" },
  instructions: [
    {
      name: "initializePool",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [{ name: "config", type: { defined: "PoolConfig" } }],
    },
    {
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
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "withdraw",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "borrow",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "repay",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "pauseProtocol",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: "resumeProtocol",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: "updatePoolConfig",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
      ],
      args: [{ name: "config", type: { defined: "PoolConfig" } }],
    },
    {
      name: "nominateAuthority",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
      ],
      args: [{ name: "newAuthority", type: "publicKey" }],
    },
    {
      name: "acceptAuthority",
      accounts: [
        { name: "newAuthority", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "LendingPool",
      type: {
        kind: "struct",
        fields: [
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
        ],
      },
    },
    {
      name: "UserPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "pool", type: "publicKey" },
          { name: "depositedAmount", type: "u64" },
          { name: "borrowedAmount", type: "u64" },
          { name: "lastUpdateSlot", type: "u64" },
          { name: "accruedInterest", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "PoolConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "reserveFactor", type: "u64" },
          { name: "collateralFactor", type: "u64" },
          { name: "liquidationThreshold", type: "u64" },
          { name: "liquidationBonus", type: "u64" },
          { name: "oracle", type: "publicKey" },
        ],
      },
    },
  ],
  errors: [],
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPoolPDA(tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

function getVaultPDA(tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

function getPositionPDA(pool: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ShieldFi Protocol", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as any, PROGRAM_ID, provider);
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;

  let tokenMint: PublicKey;
  let poolPDA: PublicKey;
  let vaultPDA: PublicKey;
  let authorityTokenAccount: PublicKey;
  let userKeypair: Keypair;
  let userTokenAccount: PublicKey;
  let userPositionPDA: PublicKey;

  const DECIMALS = 6;
  const ONE_USDC = new BN(1_000_000);
  const HUNDRED_USDC = new BN(100_000_000);
  const dummyOracle = new PublicKey("11111111111111111111111111111111");

  const poolConfig = {
    reserveFactor: new BN(1000),
    collateralFactor: new BN(7500),
    liquidationThreshold: new BN(8000),
    liquidationBonus: new BN(500),
    oracle: dummyOracle,
  };

  before(async () => {
    console.log("\n  Setting up test environment...");
    tokenMint = await createMint(
      connection, authority.payer, authority.publicKey, null, DECIMALS
    );
    [poolPDA] = getPoolPDA(tokenMint);
    [vaultPDA] = getVaultPDA(tokenMint);

    authorityTokenAccount = await createAccount(
      connection, authority.payer, tokenMint, authority.publicKey
    );
    await mintTo(
      connection, authority.payer, tokenMint,
      authorityTokenAccount, authority.payer, 1000 * 10 ** DECIMALS
    );

    userKeypair = Keypair.generate();
    const sig = await connection.requestAirdrop(userKeypair.publicKey, 2_000_000_000);
    await connection.confirmTransaction(sig);

    userTokenAccount = await createAccount(
      connection, userKeypair, tokenMint, userKeypair.publicKey
    );
    await mintTo(
      connection, authority.payer, tokenMint,
      userTokenAccount, authority.payer, 500 * 10 ** DECIMALS
    );

    [userPositionPDA] = getPositionPDA(poolPDA, userKeypair.publicKey);
    console.log("  Setup complete.\n");
  });

  it("initializes a lending pool", async () => {
    await (program.methods as any).initializePool(poolConfig)
      .accounts({
        authority: authority.publicKey, tokenMint,
        pool: poolPDA, tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      }).rpc();

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(pool.authority.equals(authority.publicKey));
    assert.equal(pool.collateralFactor.toNumber(), 7500);
    assert.isFalse(pool.isPaused);
    console.log("  ✅ Pool initialized");
  });

  it("deposits tokens as collateral", async () => {
    const amount = new BN(100 * 10 ** DECIMALS);
    await (program.methods as any).deposit(amount)
      .accounts({
        user: userKeypair.publicKey, tokenMint,
        pool: poolPDA, userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      }).signers([userKeypair]).rpc();

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.equal(pool.totalDeposits.toNumber(), amount.toNumber());
    console.log("  ✅ Deposited 100 USDC");
  });

  it("rejects zero amount deposit", async () => {
    try {
      await (program.methods as any).deposit(new BN(0))
        .accounts({
          user: userKeypair.publicKey, tokenMint,
          pool: poolPDA, userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        }).signers([userKeypair]).rpc();
      assert.fail("Should throw ZeroAmount");
    } catch (e: any) {
      assert.include(e.toString(), "ZeroAmount");
    }
    console.log("  ✅ Zero amount guard works");
  });

  it("adds admin liquidity then borrows", async () => {
    await (program.methods as any).deposit(HUNDRED_USDC)
      .accounts({
        user: authority.publicKey, tokenMint,
        pool: poolPDA, userTokenAccount: authorityTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      }).rpc();

    const borrowAmount = new BN(50 * 10 ** DECIMALS);
    await (program.methods as any).borrow(borrowAmount)
      .accounts({
        user: userKeypair.publicKey, tokenMint,
        pool: poolPDA, userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([userKeypair]).rpc();

    const pos = await (program.account as any).userPosition.fetch(userPositionPDA);
    assert.equal(pos.borrowedAmount.toNumber(), borrowAmount.toNumber());
    console.log("  ✅ Borrowed 50 USDC");
  });

  it("rejects over-borrow", async () => {
    try {
      await (program.methods as any).borrow(new BN(50 * 10 ** DECIMALS))
        .accounts({
          user: userKeypair.publicKey, tokenMint,
          pool: poolPDA, userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([userKeypair]).rpc();
      assert.fail("Should throw InsufficientCollateral");
    } catch (e: any) {
      assert.include(e.toString(), "InsufficientCollateral");
    }
    console.log("  ✅ Over-borrow rejected");
  });

  it("repays debt", async () => {
    const repayAmount = new BN(25 * 10 ** DECIMALS);
    const before = await (program.account as any).userPosition.fetch(userPositionPDA);
    await (program.methods as any).repay(repayAmount)
      .accounts({
        user: userKeypair.publicKey, tokenMint,
        pool: poolPDA, userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([userKeypair]).rpc();

    const after = await (program.account as any).userPosition.fetch(userPositionPDA);
    assert.equal(
      after.borrowedAmount.toNumber(),
      before.borrowedAmount.toNumber() - repayAmount.toNumber()
    );
    console.log("  ✅ Repaid 25 USDC");
  });

  it("pauses and resumes protocol", async () => {
    await (program.methods as any).pauseProtocol()
      .accounts({ authority: authority.publicKey, tokenMint, pool: poolPDA }).rpc();

    const paused = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.isTrue(paused.isPaused);

    try {
      await (program.methods as any).deposit(ONE_USDC)
        .accounts({
          user: userKeypair.publicKey, tokenMint,
          pool: poolPDA, userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        }).signers([userKeypair]).rpc();
      assert.fail("Should throw ProtocolPaused");
    } catch (e: any) {
      assert.include(e.toString(), "ProtocolPaused");
    }

    await (program.methods as any).resumeProtocol()
      .accounts({ authority: authority.publicKey, tokenMint, pool: poolPDA }).rpc();

    const resumed = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.isFalse(resumed.isPaused);
    console.log("  ✅ Pause/resume circuit breaker works");
  });

  it("rejects unauthorized pause", async () => {
    try {
      await (program.methods as any).pauseProtocol()
        .accounts({
          authority: userKeypair.publicKey, tokenMint, pool: poolPDA
        }).signers([userKeypair]).rpc();
      assert.fail("Should throw Unauthorized");
    } catch (e: any) {
      assert.include(e.toString(), "Unauthorized");
    }
    console.log("  ✅ Unauthorized pause rejected");
  });

  it("updates pool config", async () => {
    await (program.methods as any).updatePoolConfig({
      reserveFactor: new BN(500),
      collateralFactor: new BN(7000),
      liquidationThreshold: new BN(7500),
      liquidationBonus: new BN(800),
      oracle: dummyOracle,
    }).accounts({
      authority: authority.publicKey, tokenMint, pool: poolPDA
    }).rpc();

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.equal(pool.collateralFactor.toNumber(), 7000);
    console.log("  ✅ Config updated");
  });

  it("completes two-step authority transfer", async () => {
    const newAuth = Keypair.generate();
    const sig = await connection.requestAirdrop(newAuth.publicKey, 1_000_000_000);
    await connection.confirmTransaction(sig);

    await (program.methods as any).nominateAuthority(newAuth.publicKey)
      .accounts({ authority: authority.publicKey, tokenMint, pool: poolPDA }).rpc();

    const nominated = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(nominated.pendingAuthority.equals(newAuth.publicKey));
    assert.ok(nominated.authority.equals(authority.publicKey));

    await (program.methods as any).acceptAuthority()
      .accounts({ newAuthority: newAuth.publicKey, tokenMint, pool: poolPDA })
      .signers([newAuth]).rpc();

    const transferred = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(transferred.authority.equals(newAuth.publicKey));

    // Transfer back
    await (program.methods as any).nominateAuthority(authority.publicKey)
      .accounts({ authority: newAuth.publicKey, tokenMint, pool: poolPDA })
      .signers([newAuth]).rpc();
    await (program.methods as any).acceptAuthority()
      .accounts({ newAuthority: authority.publicKey, tokenMint, pool: poolPDA }).rpc();

    console.log("  ✅ Two-step authority transfer works");
  });

  after(() => {
    console.log("\n  ══════════════════════════════");
    console.log("  All ShieldFi tests complete!");
    console.log("  ══════════════════════════════");
  });
});

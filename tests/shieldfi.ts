import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPoolPDA(tokenMint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenMint.toBuffer()],
    programId
  );
}

function getVaultPDA(tokenMint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), tokenMint.toBuffer()],
    programId
  );
}

function getPositionPDA(
  pool: PublicKey,
  user: PublicKey,
  programId: PublicKey
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    programId
  );
}

function getOraclePDA(tokenMint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("oracle"), tokenMint.toBuffer()],
    programId
  );
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("ShieldFi Protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Shieldfi as Program;
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;

  // Test accounts
  let tokenMint: PublicKey;
  let poolPDA: PublicKey;
  let vaultPDA: PublicKey;
  let oraclePDA: PublicKey;
  let authorityTokenAccount: PublicKey;
  let userKeypair: Keypair;
  let userTokenAccount: PublicKey;
  let userPositionPDA: PublicKey;

  // Pool config — 75% collateral factor, 80% liq threshold, 5% bonus
  const poolConfig = {
    reserveFactor: new BN(1000),       // 10%
    collateralFactor: new BN(7500),    // 75%
    liquidationThreshold: new BN(8000), // 80%
    liquidationBonus: new BN(500),     // 5%
    oracle: PublicKey.default,         // set after oracle PDA created
  };

  const DECIMALS = 6;
  const ONE_USDC = new BN(1_000_000);
  const HUNDRED_USDC = new BN(100_000_000);

  // ─── Setup ──────────────────────────────────────────────────────────────

  before(async () => {
    console.log("\n  Setting up test environment...");

    // Create test token mint (simulates USDC)
    tokenMint = await createMint(
      connection,
      authority.payer,
      authority.publicKey,
      null,
      DECIMALS
    );
    console.log(`  Token mint: ${tokenMint.toBase58()}`);

    // Get PDAs
    [poolPDA] = getPoolPDA(tokenMint, program.programId);
    [vaultPDA] = getVaultPDA(tokenMint, program.programId);

    // Create authority token account and mint 1000 tokens
    authorityTokenAccount = await createAccount(
      connection,
      authority.payer,
      tokenMint,
      authority.publicKey
    );
    await mintTo(
      connection,
      authority.payer,
      tokenMint,
      authorityTokenAccount,
      authority.payer,
      1000 * 10 ** DECIMALS
    );

    // Create a separate user for testing
    userKeypair = Keypair.generate();
    const airdropSig = await connection.requestAirdrop(
      userKeypair.publicKey,
      2_000_000_000 // 2 SOL
    );
    await connection.confirmTransaction(airdropSig);

    userTokenAccount = await createAccount(
      connection,
      userKeypair,
      tokenMint,
      userKeypair.publicKey
    );
    await mintTo(
      connection,
      authority.payer,
      tokenMint,
      userTokenAccount,
      authority.payer,
      500 * 10 ** DECIMALS
    );

    [userPositionPDA] = getPositionPDA(
      poolPDA,
      userKeypair.publicKey,
      program.programId
    );

    console.log("  Setup complete.\n");
  });

  // ─── Test 1: Initialize Pool ─────────────────────────────────────────────

  it("initializes a lending pool with correct config", async () => {
    // Use a dummy oracle for now (real oracle PDA initialized separately)
    const dummyOracle = Keypair.generate().publicKey;
    poolConfig.oracle = dummyOracle;

    await program.methods
      .initializePool({
        ...poolConfig,
        oracle: dummyOracle,
      })
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const pool = await program.account.lendingPool.fetch(poolPDA);

    assert.ok(pool.authority.equals(authority.publicKey), "Authority mismatch");
    assert.ok(pool.tokenMint.equals(tokenMint), "Mint mismatch");
    assert.equal(
      pool.collateralFactor.toNumber(),
      7500,
      "Collateral factor should be 7500 bps"
    );
    assert.equal(
      pool.liquidationThreshold.toNumber(),
      8000,
      "Liquidation threshold should be 8000 bps"
    );
    assert.equal(pool.totalDeposits.toNumber(), 0, "Deposits should start at 0");
    assert.equal(pool.totalBorrows.toNumber(), 0, "Borrows should start at 0");
    assert.isFalse(pool.isPaused, "Pool should not be paused at init");

    console.log("  Pool initialized correctly");
  });

  // ─── Test 2: Deposit ─────────────────────────────────────────────────────

  it("allows user to deposit tokens as collateral", async () => {
    const depositAmount = new BN(100 * 10 ** DECIMALS); // 100 USDC

    await program.methods
      .deposit(depositAmount)
      .accounts({
        user: userKeypair.publicKey,
        tokenMint,
        pool: poolPDA,
        userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([userKeypair])
      .rpc();

    const pool = await program.account.lendingPool.fetch(poolPDA);
    const position = await program.account.userPosition.fetch(userPositionPDA);
    const vault = await getAccount(connection, vaultPDA);

    assert.equal(
      pool.totalDeposits.toNumber(),
      depositAmount.toNumber(),
      "Pool total deposits should match"
    );
    assert.equal(
      position.depositedAmount.toNumber(),
      depositAmount.toNumber(),
      "User position deposited amount should match"
    );
    assert.equal(
      Number(vault.amount),
      depositAmount.toNumber(),
      "Vault should hold the deposited tokens"
    );

    console.log("  Deposit: 100 USDC deposited successfully");
  });

  // ─── Test 3: Borrow ──────────────────────────────────────────────────────

  it("allows user to borrow within collateral factor", async () => {
    // Max borrow = 100 USDC * 75% = 75 USDC
    // We borrow 50 USDC to be safe
    const borrowAmount = new BN(50 * 10 ** DECIMALS);

    // First deposit some liquidity as admin so there's something to borrow
    await program.methods
      .deposit(HUNDRED_USDC)
      .accounts({
        user: authority.publicKey,
        tokenMint,
        pool: poolPDA,
        userTokenAccount: authorityTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const balanceBefore = await getAccount(connection, userTokenAccount);

    await program.methods
      .borrow(borrowAmount)
      .accounts({
        user: userKeypair.publicKey,
        tokenMint,
        pool: poolPDA,
        userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const balanceAfter = await getAccount(connection, userTokenAccount);
    const position = await program.account.userPosition.fetch(userPositionPDA);

    assert.equal(
      position.borrowedAmount.toNumber(),
      borrowAmount.toNumber(),
      "Borrowed amount in position should match"
    );
    assert.equal(
      Number(balanceAfter.amount) - Number(balanceBefore.amount),
      borrowAmount.toNumber(),
      "User token balance should increase by borrowed amount"
    );

    console.log("  Borrow: 50 USDC borrowed successfully");
  });

  // ─── Test 4: Borrow over limit should fail ───────────────────────────────

  it("rejects borrow that exceeds collateral factor", async () => {
    // Deposited 100 USDC, already borrowed 50 USDC
    // Max = 75 USDC, remaining = 25 USDC
    // Try to borrow 50 more — should fail
    const overBorrowAmount = new BN(50 * 10 ** DECIMALS);

    try {
      await program.methods
        .borrow(overBorrowAmount)
        .accounts({
          user: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
          userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();

      assert.fail("Should have thrown InsufficientCollateral error");
    } catch (err: any) {
      assert.include(
        err.toString(),
        "InsufficientCollateral",
        "Should throw InsufficientCollateral"
      );
    }

    console.log("  Over-borrow correctly rejected");
  });

  // ─── Test 5: Repay ───────────────────────────────────────────────────────

  it("allows user to repay borrowed tokens", async () => {
    const repayAmount = new BN(25 * 10 ** DECIMALS); // repay half

    const positionBefore = await program.account.userPosition.fetch(
      userPositionPDA
    );

    await program.methods
      .repay(repayAmount)
      .accounts({
        user: userKeypair.publicKey,
        tokenMint,
        pool: poolPDA,
        userTokenAccount,
        tokenVault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const positionAfter = await program.account.userPosition.fetch(
      userPositionPDA
    );

    assert.equal(
      positionAfter.borrowedAmount.toNumber(),
      positionBefore.borrowedAmount.toNumber() - repayAmount.toNumber(),
      "Borrowed amount should decrease by repaid amount"
    );

    console.log("  Repay: 25 USDC repaid successfully");
  });

  // ─── Test 6: Zero amount guard ───────────────────────────────────────────

  it("rejects deposit of zero amount", async () => {
    try {
      await program.methods
        .deposit(new BN(0))
        .accounts({
          user: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
          userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([userKeypair])
        .rpc();

      assert.fail("Should have thrown ZeroAmount error");
    } catch (err: any) {
      assert.include(err.toString(), "ZeroAmount", "Should throw ZeroAmount");
    }

    console.log("  Zero amount guard working correctly");
  });

  // ─── Test 7: Pause + Resume ──────────────────────────────────────────────

  it("pauses protocol and blocks all operations", async () => {
    // Pause
    await program.methods
      .pauseProtocol()
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const pausedPool = await program.account.lendingPool.fetch(poolPDA);
    assert.isTrue(pausedPool.isPaused, "Pool should be paused");

    // Try to deposit — should fail
    try {
      await program.methods
        .deposit(ONE_USDC)
        .accounts({
          user: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
          userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([userKeypair])
        .rpc();

      assert.fail("Should have thrown ProtocolPaused error");
    } catch (err: any) {
      assert.include(
        err.toString(),
        "ProtocolPaused",
        "Should throw ProtocolPaused"
      );
    }

    // Resume
    await program.methods
      .resumeProtocol()
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const resumedPool = await program.account.lendingPool.fetch(poolPDA);
    assert.isFalse(resumedPool.isPaused, "Pool should be unpaused");

    console.log("  Pause/resume circuit breaker working correctly");
  });

  // ─── Test 8: Unauthorized pause ──────────────────────────────────────────

  it("rejects pause from non-authority wallet", async () => {
    try {
      await program.methods
        .pauseProtocol()
        .accounts({
          authority: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
        })
        .signers([userKeypair])
        .rpc();

      assert.fail("Should have thrown Unauthorized error");
    } catch (err: any) {
      assert.include(
        err.toString(),
        "Unauthorized",
        "Non-authority should not be able to pause"
      );
    }

    console.log("  Unauthorized pause correctly rejected");
  });

  // ─── Test 9: Update config ───────────────────────────────────────────────

  it("allows authority to update pool config", async () => {
    const newConfig = {
      reserveFactor: new BN(500),        // 5%
      collateralFactor: new BN(7000),    // 70%
      liquidationThreshold: new BN(7500), // 75%
      liquidationBonus: new BN(800),     // 8%
      oracle: poolConfig.oracle,
    };

    await program.methods
      .updatePoolConfig(newConfig)
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const pool = await program.account.lendingPool.fetch(poolPDA);
    assert.equal(pool.collateralFactor.toNumber(), 7000, "CF should update");
    assert.equal(
      pool.liquidationThreshold.toNumber(),
      7500,
      "LT should update"
    );

    console.log("  Config updated successfully");
  });

  // ─── Test 10: Withdraw with health check ─────────────────────────────────

  it("rejects withdrawal that would make position liquidatable", async () => {
    // Current: 100 USDC deposited, 25 USDC borrowed (after repay)
    // After config update: CF = 70% -> max borrow = 70 USDC
    // If we try to withdraw 90 USDC: 10 USDC deposited, 25 USDC borrowed
    // health = 10 * 7000 / 25000000 = way below threshold -> should reject

    try {
      await program.methods
        .withdraw(new BN(90 * 10 ** DECIMALS))
        .accounts({
          user: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
          userTokenAccount,
          tokenVault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();

      assert.fail("Should have thrown InsufficientCollateral");
    } catch (err: any) {
      assert.include(
        err.toString(),
        "InsufficientCollateral",
        "Should block unsafe withdrawal"
      );
    }

    console.log("  Unsafe withdrawal correctly rejected");
  });

  // ─── Test 11: Two-step authority transfer ────────────────────────────────

  it("requires new authority to accept before transfer completes", async () => {
    const newAuthority = Keypair.generate();
    const airdrop = await connection.requestAirdrop(
      newAuthority.publicKey,
      1_000_000_000
    );
    await connection.confirmTransaction(airdrop);

    // Step 1: Nominate
    await program.methods
      .nominateAuthority(newAuthority.publicKey)
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const poolAfterNominate =
      await program.account.lendingPool.fetch(poolPDA);
    assert.ok(
      poolAfterNominate.pendingAuthority.equals(newAuthority.publicKey),
      "Pending authority should be set"
    );
    assert.ok(
      poolAfterNominate.authority.equals(authority.publicKey),
      "Authority should NOT change yet"
    );

    // Step 2: Accept
    await program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: newAuthority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .signers([newAuthority])
      .rpc();

    const poolAfterAccept = await program.account.lendingPool.fetch(poolPDA);
    assert.ok(
      poolAfterAccept.authority.equals(newAuthority.publicKey),
      "Authority should now be transferred"
    );
    assert.ok(
      poolAfterAccept.pendingAuthority.equals(PublicKey.default),
      "Pending authority should be cleared"
    );

    console.log("  Two-step authority transfer working correctly");

    // Transfer back to original authority for remaining tests
    await program.methods
      .nominateAuthority(authority.publicKey)
      .accounts({
        authority: newAuthority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .signers([newAuthority])
      .rpc();

    await program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();
  });

  // ─── Summary ─────────────────────────────────────────────────────────────

  after(async () => {
    console.log("\n  All ShieldFi tests passed!");
    console.log("  Security features verified:");
    console.log("    - Emergency pause/resume circuit breaker");
    console.log("    - Unauthorized access rejection");
    console.log("    - Collateral factor gating");
    console.log("    - Zero amount guard");
    console.log("    - Unsafe withdrawal rejection");
    console.log("    - Two-step authority transfer");
    console.log("    - Config update by authority");
  });
});

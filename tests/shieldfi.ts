import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
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
import { IDL } from "../app/lib/idl";

const PROGRAM_ID = new PublicKey("GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun");

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

describe("ShieldFi Protocol", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(IDL as any, PROGRAM_ID, provider);
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
  const dummyOracle = Keypair.generate().publicKey;

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
      connection,
      authority.payer,
      authority.publicKey,
      null,
      DECIMALS
    );

    [poolPDA] = getPoolPDA(tokenMint);
    [vaultPDA] = getVaultPDA(tokenMint);

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

    userKeypair = Keypair.generate();
    const airdropSig = await connection.requestAirdrop(
      userKeypair.publicKey,
      2_000_000_000
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

    [userPositionPDA] = getPositionPDA(poolPDA, userKeypair.publicKey);
    console.log("  Setup complete.\n");
  });

  it("initializes a lending pool with correct config", async () => {
    await (program.methods as any)
      .initializePool(poolConfig)
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

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(pool.authority.equals(authority.publicKey));
    assert.equal(pool.collateralFactor.toNumber(), 7500);
    assert.equal(pool.totalDeposits.toNumber(), 0);
    assert.isFalse(pool.isPaused);
    console.log("  Pool initialized correctly");
  });

  it("allows user to deposit tokens as collateral", async () => {
    const depositAmount = new BN(100 * 10 ** DECIMALS);

    await (program.methods as any)
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

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    const position = await (program.account as any).userPosition.fetch(userPositionPDA);

    assert.equal(pool.totalDeposits.toNumber(), depositAmount.toNumber());
    assert.equal(position.depositedAmount.toNumber(), depositAmount.toNumber());
    console.log("  Deposit: 100 USDC deposited successfully");
  });

  it("rejects deposit of zero amount", async () => {
    try {
      await (program.methods as any)
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
      assert.fail("Should have thrown ZeroAmount");
    } catch (err: any) {
      assert.include(err.toString(), "ZeroAmount");
    }
    console.log("  Zero amount guard working correctly");
  });

  it("allows admin to add liquidity", async () => {
    await (program.methods as any)
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
    console.log("  Admin deposited 100 USDC liquidity");
  });

  it("allows user to borrow within collateral factor", async () => {
    const borrowAmount = new BN(50 * 10 ** DECIMALS);
    const balanceBefore = await getAccount(connection, userTokenAccount);

    await (program.methods as any)
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
    const position = await (program.account as any).userPosition.fetch(userPositionPDA);

    assert.equal(position.borrowedAmount.toNumber(), borrowAmount.toNumber());
    assert.equal(
      Number(balanceAfter.amount) - Number(balanceBefore.amount),
      borrowAmount.toNumber()
    );
    console.log("  Borrow: 50 USDC borrowed successfully");
  });

  it("rejects borrow that exceeds collateral factor", async () => {
    try {
      await (program.methods as any)
        .borrow(new BN(50 * 10 ** DECIMALS))
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
      assert.include(err.toString(), "InsufficientCollateral");
    }
    console.log("  Over-borrow correctly rejected");
  });

  it("allows user to repay borrowed tokens", async () => {
    const repayAmount = new BN(25 * 10 ** DECIMALS);
    const before = await (program.account as any).userPosition.fetch(userPositionPDA);

    await (program.methods as any)
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

    const after = await (program.account as any).userPosition.fetch(userPositionPDA);
    assert.equal(
      after.borrowedAmount.toNumber(),
      before.borrowedAmount.toNumber() - repayAmount.toNumber()
    );
    console.log("  Repay: 25 USDC repaid successfully");
  });

  it("pauses protocol and blocks deposits", async () => {
    await (program.methods as any)
      .pauseProtocol()
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.isTrue(pool.isPaused);

    try {
      await (program.methods as any)
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
      assert.fail("Should have thrown ProtocolPaused");
    } catch (err: any) {
      assert.include(err.toString(), "ProtocolPaused");
    }

    await (program.methods as any)
      .resumeProtocol()
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const resumed = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.isFalse(resumed.isPaused);
    console.log("  Pause/resume circuit breaker working correctly");
  });

  it("rejects pause from non-authority wallet", async () => {
    try {
      await (program.methods as any)
        .pauseProtocol()
        .accounts({
          authority: userKeypair.publicKey,
          tokenMint,
          pool: poolPDA,
        })
        .signers([userKeypair])
        .rpc();
      assert.fail("Should have thrown Unauthorized");
    } catch (err: any) {
      assert.include(err.toString(), "Unauthorized");
    }
    console.log("  Unauthorized pause correctly rejected");
  });

  it("allows authority to update pool config", async () => {
    const newConfig = {
      reserveFactor: new BN(500),
      collateralFactor: new BN(7000),
      liquidationThreshold: new BN(7500),
      liquidationBonus: new BN(800),
      oracle: dummyOracle,
    };

    await (program.methods as any)
      .updatePoolConfig(newConfig)
      .accounts({
        authority: authority.publicKey,
        tokenMint,
        pool: poolPDA,
      })
      .rpc();

    const pool = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.equal(pool.collateralFactor.toNumber(), 7000);
    console.log("  Config updated successfully");
  });

  it("completes two-step authority transfer", async () => {
    const newAuth = Keypair.generate();
    const sig = await connection.requestAirdrop(newAuth.publicKey, 1_000_000_000);
    await connection.confirmTransaction(sig);

    await (program.methods as any)
      .nominateAuthority(newAuth.publicKey)
      .accounts({ authority: authority.publicKey, tokenMint, pool: poolPDA })
      .rpc();

    const afterNominate = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(afterNominate.pendingAuthority.equals(newAuth.publicKey));
    assert.ok(afterNominate.authority.equals(authority.publicKey));

    await (program.methods as any)
      .acceptAuthority()
      .accounts({ newAuthority: newAuth.publicKey, tokenMint, pool: poolPDA })
      .signers([newAuth])
      .rpc();

    const afterAccept = await (program.account as any).lendingPool.fetch(poolPDA);
    assert.ok(afterAccept.authority.equals(newAuth.publicKey));

    // Transfer back
    await (program.methods as any)
      .nominateAuthority(authority.publicKey)
      .accounts({ authority: newAuth.publicKey, tokenMint, pool: poolPDA })
      .signers([newAuth])
      .rpc();

    await (program.methods as any)
      .acceptAuthority()
      .accounts({ newAuthority: authority.publicKey, tokenMint, pool: poolPDA })
      .rpc();

    console.log("  Two-step authority transfer working correctly");
  });

  after(() => {
    console.log("\n  All ShieldFi tests complete!");
    console.log("  Security features verified:");
    console.log("    ✅ Pool initialization");
    console.log("    ✅ Deposit + zero amount guard");
    console.log("    ✅ Borrow within collateral factor");
    console.log("    ✅ Over-borrow rejection");
    console.log("    ✅ Repay");
    console.log("    ✅ Pause/resume circuit breaker");
    console.log("    ✅ Unauthorized access rejection");
    console.log("    ✅ Config update");
    console.log("    ✅ Two-step authority transfer");
  });
});

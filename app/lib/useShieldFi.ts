"use client";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { IDL } from "./idl";
import {
  PROGRAM_ID,
  USDC_MINT,
  getPoolPDA,
  getVaultPDA,
  getPositionPDA,
  formatAmount,
} from "./constants";

export interface PoolData {
  totalDeposits: string;
  totalBorrows: string;
  utilizationRate: string;
  collateralFactor: string;
  liquidationThreshold: string;
  isPaused: boolean;
}

export interface PositionData {
  depositedAmount: string;
  borrowedAmount: string;
  accruedInterest: string;
  healthFactor: string;
  maxBorrow: string;
}

export function useShieldFi() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    // Anchor 0.29: Program(idl, programId, provider)
    return new Program(IDL as any, PROGRAM_ID, provider);
  }, [connection, wallet]);

  const fetchPoolData = useCallback(async () => {
    try {
      const program = getProgram();
      if (!program) return;
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const pool = await (program.account as any).lendingPool.fetch(poolPDA);
      const utilization =
        pool.totalDeposits.toNumber() > 0
          ? (pool.totalBorrows.toNumber() / pool.totalDeposits.toNumber()) * 100
          : 0;
      setPoolData({
        totalDeposits: formatAmount(pool.totalDeposits.toNumber()),
        totalBorrows: formatAmount(pool.totalBorrows.toNumber()),
        utilizationRate: utilization.toFixed(2) + "%",
        collateralFactor: (pool.collateralFactor.toNumber() / 100).toFixed(0) + "%",
        liquidationThreshold: (pool.liquidationThreshold.toNumber() / 100).toFixed(0) + "%",
        isPaused: pool.isPaused,
      });
    } catch {
      setPoolData(null);
    }
  }, [getProgram]);

  const fetchPositionData = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const program = getProgram();
      if (!program) return;
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [positionPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const position = await (program.account as any).userPosition.fetch(positionPDA);
      const pool = await (program.account as any).lendingPool.fetch(poolPDA);
      const deposited = position.depositedAmount.toNumber();
      const borrowed = position.borrowedAmount.toNumber();
      const interest = position.accruedInterest.toNumber();
      const cf = pool.collateralFactor.toNumber();
      const totalDebt = borrowed + interest;
      const health = totalDebt > 0 ? Math.floor((deposited * cf) / totalDebt) : 999999;
      const maxBorrow = Math.floor((deposited * cf) / 10_000) - totalDebt;
      setPositionData({
        depositedAmount: formatAmount(deposited),
        borrowedAmount: formatAmount(borrowed),
        accruedInterest: formatAmount(interest),
        healthFactor: health === 999999 ? "Infinity" : (health / 100).toFixed(2),
        maxBorrow: formatAmount(Math.max(0, maxBorrow)),
      });
    } catch {
      setPositionData(null);
    }
  }, [getProgram, wallet.publicKey]);

  const deposit = useCallback(async (amount: number) => {
    if (!wallet.publicKey) return;
    setTxLoading(true); setError(null); setTxSignature(null);
    try {
      const program = getProgram();
      if (!program) throw new Error("Wallet not connected");
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const tx = await (program.methods as any)
        .deposit(new BN(amount * 1_000_000))
        .accounts({ user: wallet.publicKey, tokenMint: USDC_MINT, pool: poolPDA, userTokenAccount: userATA, tokenVault: vaultPDA })
        .rpc();
      setTxSignature(tx);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) { setError(e.message || "Deposit failed"); }
    finally { setTxLoading(false); }
  }, [getProgram, wallet.publicKey, fetchPoolData, fetchPositionData]);

  const withdraw = useCallback(async (amount: number) => {
    if (!wallet.publicKey) return;
    setTxLoading(true); setError(null);
    try {
      const program = getProgram();
      if (!program) throw new Error("Wallet not connected");
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const tx = await (program.methods as any)
        .withdraw(new BN(amount * 1_000_000))
        .accounts({ user: wallet.publicKey, tokenMint: USDC_MINT, pool: poolPDA, userTokenAccount: userATA, tokenVault: vaultPDA })
        .rpc();
      setTxSignature(tx);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) { setError(e.message || "Withdraw failed"); }
    finally { setTxLoading(false); }
  }, [getProgram, wallet.publicKey, fetchPoolData, fetchPositionData]);

  const borrow = useCallback(async (amount: number) => {
    if (!wallet.publicKey) return;
    setTxLoading(true); setError(null);
    try {
      const program = getProgram();
      if (!program) throw new Error("Wallet not connected");
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const tx = await (program.methods as any)
        .borrow(new BN(amount * 1_000_000))
        .accounts({ user: wallet.publicKey, tokenMint: USDC_MINT, pool: poolPDA, userTokenAccount: userATA, tokenVault: vaultPDA })
        .rpc();
      setTxSignature(tx);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) { setError(e.message || "Borrow failed"); }
    finally { setTxLoading(false); }
  }, [getProgram, wallet.publicKey, fetchPoolData, fetchPositionData]);

  const repay = useCallback(async (amount: number) => {
    if (!wallet.publicKey) return;
    setTxLoading(true); setError(null);
    try {
      const program = getProgram();
      if (!program) throw new Error("Wallet not connected");
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const tx = await (program.methods as any)
        .repay(new BN(amount * 1_000_000))
        .accounts({ user: wallet.publicKey, tokenMint: USDC_MINT, pool: poolPDA, userTokenAccount: userATA, tokenVault: vaultPDA })
        .rpc();
      setTxSignature(tx);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) { setError(e.message || "Repay failed"); }
    finally { setTxLoading(false); }
  }, [getProgram, wallet.publicKey, fetchPoolData, fetchPositionData]);

  useEffect(() => { fetchPoolData(); }, [fetchPoolData]);
  useEffect(() => { if (wallet.publicKey) fetchPositionData(); }, [wallet.publicKey, fetchPositionData]);

  return {
    poolData, positionData, txLoading, error, txSignature,
    deposit, withdraw, borrow, repay,
    refetch: () => { fetchPoolData(); fetchPositionData(); },
  };
}
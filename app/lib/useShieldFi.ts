"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { USDC_MINT, getPoolPDA, getPositionPDA, formatAmount, RPC_ENDPOINT } from "./constants";

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

const conn = new Connection(RPC_ENDPOINT, "confirmed");

function decodeLendingPool(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset);
  let o = 8; // skip 8-byte discriminator
  const pk = () => { const p = new PublicKey(data.slice(o, o + 32)); o += 32; return p; };
  const u64 = () => { const lo = view.getUint32(o, true); const hi = view.getUint32(o + 4, true); o += 8; return lo + hi * 4294967296; };
  const bool = () => { const b = data[o]; o += 1; return b === 1; };
  const u8 = () => { const b = data[o]; o += 1; return b; };
  return {
    authority: pk(), pendingAuthority: pk(), tokenMint: pk(),
    tokenVault: pk(), oracle: pk(),
    totalDeposits: u64(), totalBorrows: u64(),
    reserveFactor: u64(), collateralFactor: u64(),
    liquidationThreshold: u64(), liquidationBonus: u64(),
    withdrawalLimitBps: u64(), rateLimitSlot: u64(), withdrawnThisSlot: u64(), isPaused: bool(), bump: u8(),
  };
}

function decodeUserPosition(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset);
  let o = 8;
  const pk = () => { const p = new PublicKey(data.slice(o, o + 32)); o += 32; return p; };
  const u64 = () => { const lo = view.getUint32(o, true); const hi = view.getUint32(o + 4, true); o += 8; return lo + hi * 4294967296; };
  const u8 = () => { const b = data[o]; o += 1; return b; };
  return {
    owner: pk(), pool: pk(),
    depositedAmount: u64(), borrowedAmount: u64(),
    lastUpdateSlot: u64(), accruedInterest: u64(),
    bump: u8(),
  };
}

export function useShieldFi() {
  const wallet = useWallet();
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [txLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [txSignature] = useState<string | null>(null);

  const fetchPoolData = useCallback(async () => {
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const account = await conn.getAccountInfo(poolPDA);
      if (!account) { setPoolData(null); return; }
      const pool = decodeLendingPool(new Uint8Array(account.data));
      const utilization = pool.totalDeposits > 0 ? (pool.totalBorrows / pool.totalDeposits) * 100 : 0;
      setPoolData({
        totalDeposits: formatAmount(pool.totalDeposits),
        totalBorrows: formatAmount(pool.totalBorrows),
        utilizationRate: utilization.toFixed(2) + "%",
        collateralFactor: (pool.collateralFactor / 100).toFixed(0) + "%",
        liquidationThreshold: (pool.liquidationThreshold / 100).toFixed(0) + "%",
        isPaused: pool.isPaused,
      });
    } catch (e) {
      console.error("fetchPoolData error:", e);
      setPoolData(null);
    }
  }, []);

  const fetchPositionData = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [posPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const [posAcc, poolAcc] = await Promise.all([
        conn.getAccountInfo(posPDA),
        conn.getAccountInfo(poolPDA),
      ]);
      if (!posAcc || !poolAcc) { setPositionData(null); return; }
      const pos = decodeUserPosition(new Uint8Array(posAcc.data));
      const pool = decodeLendingPool(new Uint8Array(poolAcc.data));
      const cf = pool.collateralFactor;
      const totalDebt = pos.borrowedAmount + pos.accruedInterest;
      const health = totalDebt > 0 ? Math.floor((pos.depositedAmount * cf) / totalDebt) : 999999;
      const maxBorrow = Math.floor((pos.depositedAmount * cf) / 10_000) - totalDebt;
      setPositionData({
        depositedAmount: formatAmount(pos.depositedAmount),
        borrowedAmount: formatAmount(pos.borrowedAmount),
        accruedInterest: formatAmount(pos.accruedInterest),
        healthFactor: health === 999999 ? "∞" : (health / 100).toFixed(2),
        maxBorrow: formatAmount(Math.max(0, maxBorrow)),
      });
    } catch { setPositionData(null); }
  }, [wallet.publicKey]);

  const noop = async (_: number) => {};

  useEffect(() => { fetchPoolData(); }, [fetchPoolData]);
  useEffect(() => { if (wallet.publicKey) fetchPositionData(); }, [wallet.publicKey, fetchPositionData]);

  return {
    poolData, positionData, txLoading, error, txSignature,
    deposit: noop, withdraw: noop, borrow: noop, repay: noop,
    refetch: () => { fetchPoolData(); fetchPositionData(); },
  };
}

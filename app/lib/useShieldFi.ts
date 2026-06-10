"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { USDC_MINT, getPoolPDA, getVaultPDA, getPositionPDA, formatAmount, RPC_ENDPOINT, PROGRAM_ID } from "./constants";

export interface PoolData {
  totalDeposits: string; totalBorrows: string;
  utilizationRate: string; collateralFactor: string;
  liquidationThreshold: string; isPaused: boolean;
}
export interface PositionData {
  depositedAmount: string; borrowedAmount: string;
  accruedInterest: string; healthFactor: string; maxBorrow: string;
}

const conn = new Connection(RPC_ENDPOINT, "confirmed");
const PID = PROGRAM_ID;

// ── Anchor discriminators (sha256("global:name")[0:8]) ──────────
async function disc(name: string): Promise<Buffer> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`global:${name}`) as unknown as ArrayBuffer);
  return Buffer.from(hash).slice(0, 8);
}

function u64LE(n: number): Buffer {
  const buf = Buffer.alloc(8);
  const big = BigInt(Math.floor(n));
  buf.writeUInt32LE(Number(big & 0xFFFFFFFFn), 0);
  buf.writeUInt32LE(Number(big >> 32n), 4);
  return buf;
}

// ── Raw account decoders ────────────────────────────────────────
function decodeLendingPool(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset);
  let o = 8;
  const pk = () => { const p = new PublicKey(data.slice(o, o + 32)); o += 32; return p; };
  const u64 = () => { const lo = view.getUint32(o, true); const hi = view.getUint32(o + 4, true); o += 8; return lo + hi * 4294967296; };
  const bool = () => { const b = data[o]; o += 1; return b === 1; };
  return {
    authority: pk(), pendingAuthority: pk(), tokenMint: pk(),
    tokenVault: pk(), oracle: pk(),
    totalDeposits: u64(), totalBorrows: u64(),
    reserveFactor: u64(), collateralFactor: u64(),
    liquidationThreshold: u64(), liquidationBonus: u64(),
    withdrawalLimitBps: u64(), rateLimitSlot: u64(), withdrawnThisSlot: u64(), borrowRateBps: u64(), treasuryAccumulated: u64(),
    isPaused: bool(),
  };
}

function decodeUserPosition(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset);
  let o = 8;
  const pk = () => { const p = new PublicKey(data.slice(o, o + 32)); o += 32; return p; };
  const u64 = () => { const lo = view.getUint32(o, true); const hi = view.getUint32(o + 4, true); o += 8; return lo + hi * 4294967296; };
  return { owner: pk(), pool: pk(), depositedAmount: u64(), borrowedAmount: u64(), lastUpdateSlot: u64(), accruedInterest: u64() };
}

// ── Build + send instruction ────────────────────────────────────
async function sendIx(
  wallet: any,
  connection: Connection,
  instructionName: string,
  amount: number,
  accounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  extraIxs: TransactionInstruction[] = []
) {
  const discriminator = await disc(instructionName);
  const data = Buffer.concat([discriminator, u64LE(amount * 1_000_000)]);
  const ix = new TransactionInstruction({ programId: PID, keys: accounts, data });
  const tx = new Transaction();
  extraIxs.forEach(e => tx.add(e));
  tx.add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = wallet.publicKey;
  const sig = await wallet.sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: "confirmed" });
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash, }, "confirmed");
  return sig;
}

export function useShieldFi() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // ── Fetch pool ──────────────────────────────────────────────
  const fetchPoolData = useCallback(async () => {
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const acc = await conn.getAccountInfo(poolPDA);
      if (!acc) { setPoolData(null); return; }
      const pool = decodeLendingPool(new Uint8Array(acc.data));
      const util = pool.totalDeposits > 0 ? (pool.totalBorrows / pool.totalDeposits) * 100 : 0;
      setPoolData({
        totalDeposits: formatAmount(pool.totalDeposits),
        totalBorrows: formatAmount(pool.totalBorrows),
        utilizationRate: util.toFixed(2) + "%",
        collateralFactor: (pool.collateralFactor / 100).toFixed(0) + "%",
        liquidationThreshold: (pool.liquidationThreshold / 100).toFixed(0) + "%",
        isPaused: pool.isPaused,
      });
    } catch (e) { console.error("fetchPool:", e); setPoolData(null); }
  }, []);

  // ── Fetch position ──────────────────────────────────────────
  const fetchPositionData = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [posPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const [posAcc, poolAcc] = await Promise.all([conn.getAccountInfo(posPDA), conn.getAccountInfo(poolPDA)]);
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

  // ── Get or create ATA ───────────────────────────────────────
  const getOrCreateATA = useCallback(async (extraIxs: TransactionInstruction[]) => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    const ata = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
    try {
      await getAccount(connection, ata);
    } catch {
      extraIxs.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, ata, wallet.publicKey, USDC_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    return ata;
  }, [connection, wallet.publicKey]);

  // ── Deposit ─────────────────────────────────────────────────
  const deposit = useCallback(async (amount: number) => {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setTxLoading(true); setError(null); setTxSignature(null);
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const [positionPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const extraIxs: TransactionInstruction[] = [];
      const userATA = await getOrCreateATA(extraIxs);

      const sig = await sendIx(wallet, connection, "deposit", amount, [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ], extraIxs);

      setTxSignature(sig);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) {
      setError(e?.message?.includes("0x") ? parseAnchorError(e.message) : (e.message || "Deposit failed"));
    } finally { setTxLoading(false); }
  }, [wallet, connection, getOrCreateATA, fetchPoolData, fetchPositionData]);

  // ── Withdraw ─────────────────────────────────────────────────
  const withdraw = useCallback(async (amount: number) => {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setTxLoading(true); setError(null); setTxSignature(null);
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const [positionPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

      const sig = await sendIx(wallet, connection, "withdraw", amount, [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]);

      setTxSignature(sig);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) {
      setError(e?.message?.includes("0x") ? parseAnchorError(e.message) : (e.message || "Withdraw failed"));
    } finally { setTxLoading(false); }
  }, [wallet, connection, fetchPoolData, fetchPositionData]);

  // ── Borrow ───────────────────────────────────────────────────
  const borrow = useCallback(async (amount: number) => {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setTxLoading(true); setError(null); setTxSignature(null);
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const [positionPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const extraIxs: TransactionInstruction[] = [];
      const userATA = await getOrCreateATA(extraIxs);

      const sig = await sendIx(wallet, connection, "borrow", amount, [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], extraIxs);

      setTxSignature(sig);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) {
      setError(e?.message?.includes("0x") ? parseAnchorError(e.message) : (e.message || "Borrow failed"));
    } finally { setTxLoading(false); }
  }, [wallet, connection, getOrCreateATA, fetchPoolData, fetchPositionData]);

  // ── Repay ────────────────────────────────────────────────────
  const repay = useCallback(async (amount: number) => {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setTxLoading(true); setError(null); setTxSignature(null);
    try {
      const [poolPDA] = getPoolPDA(USDC_MINT);
      const [vaultPDA] = getVaultPDA(USDC_MINT);
      const [positionPDA] = getPositionPDA(poolPDA, wallet.publicKey);
      const userATA = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

      const sig = await sendIx(wallet, connection, "repay", amount, [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]);

      setTxSignature(sig);
      await fetchPoolData(); await fetchPositionData();
    } catch (e: any) {
      setError(e?.message?.includes("0x") ? parseAnchorError(e.message) : (e.message || "Repay failed"));
    } finally { setTxLoading(false); }
  }, [wallet, connection, fetchPoolData, fetchPositionData]);

  // ── Error parser ─────────────────────────────────────────────
  function parseAnchorError(msg: string): string {
    if (msg.includes("0x1771") || msg.includes("6001")) return "❌ InsufficientCollateral — borrow amount exceeds your collateral limit";
    if (msg.includes("0x1772") || msg.includes("6002")) return "✅ Position is healthy — liquidation not needed";
    if (msg.includes("0x1770") || msg.includes("6000")) return "⏸ Protocol is paused by admin";
    if (msg.includes("0x1773") || msg.includes("6003")) return "❌ Amount must be greater than zero";
    if (msg.includes("0x1774") || msg.includes("6004")) return "❌ Insufficient pool liquidity";
    if (msg.includes("0x1779") || msg.includes("6009")) return "❌ Withdraw exceeds your deposit";
    if (msg.includes("0x1781") || msg.includes("6017")) return "⚡ Rate limit exceeded — max $500 per slot";
    if (msg.includes("0x1782") || msg.includes("6018")) return "⚡ Borrow rate limit exceeded — max $500 per slot";
    return msg.slice(0, 120);
  }

  useEffect(() => { fetchPoolData(); }, [fetchPoolData]);
  useEffect(() => { if (wallet.publicKey) fetchPositionData(); }, [wallet.publicKey, fetchPositionData]);

  return {
    poolData, positionData, txLoading, error, txSignature,
    deposit, withdraw, borrow, repay,
    refetch: () => { fetchPoolData(); fetchPositionData(); },
  };
}
"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Action = "deposit" | "withdraw" | "borrow" | "repay";

interface Props {
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: (amount: number) => Promise<void>;
  onBorrow: (amount: number) => Promise<void>;
  onRepay: (amount: number) => Promise<void>;
  txLoading: boolean;
  error: string | null;
  txSignature: string | null;
}

const tabs: { id: Action; label: string; color: string }[] = [
  { id: "deposit", label: "Deposit", color: "bg-green-600 hover:bg-green-700" },
  { id: "withdraw", label: "Withdraw", color: "bg-gray-600 hover:bg-gray-700" },
  { id: "borrow", label: "Borrow", color: "bg-blue-600 hover:bg-blue-700" },
  { id: "repay", label: "Repay", color: "bg-orange-600 hover:bg-orange-700" },
];

const descriptions: Record<Action, string> = {
  deposit: "Supply USDC as collateral to earn yield and unlock borrowing power.",
  withdraw: "Remove deposited collateral (health factor must stay safe).",
  borrow: "Borrow USDC against your collateral (up to collateral factor).",
  repay: "Repay your outstanding USDC loan (interest paid first).",
};

export function ActionPanel({
  onDeposit, onWithdraw, onBorrow, onRepay,
  txLoading, error, txSignature,
}: Props) {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<Action>("deposit");
  const [amount, setAmount] = useState("");

  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const handlers = {
      deposit: onDeposit,
      withdraw: onWithdraw,
      borrow: onBorrow,
      repay: onRepay,
    };
    await handlers[activeTab](val);
    setAmount("");
  };

  const activeTabInfo = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-300">Actions</h2>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setAmount(""); }}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? tab.color + " text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-4">{descriptions[activeTab]}</p>

      {/* Amount Input */}
      <div className="relative mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                     text-white placeholder-gray-600 text-lg focus:outline-none
                     focus:border-blue-500 transition-colors pr-20"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
          USDC
        </span>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 mb-4">
        {["10", "50", "100", "500"].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className="flex-1 py-1 text-xs bg-gray-800 hover:bg-gray-700
                       text-gray-400 rounded-lg transition-colors"
          >
            ${v}
          </button>
        ))}
      </div>

      {/* Submit */}
      {connected ? (
        <button
          onClick={handleSubmit}
          disabled={txLoading || !amount}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
            txLoading || !amount
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : activeTabInfo.color
          }`}
        >
          {txLoading
            ? "Processing..."
            : `${activeTabInfo.label} ${amount ? `$${amount}` : ""} USDC`}
        </button>
      ) : (
        <button
          disabled
          className="w-full py-3 rounded-xl font-semibold text-gray-500
                     bg-gray-800 cursor-not-allowed"
        >
          Connect Wallet to Continue
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/30 border border-red-800
                        rounded-xl text-red-400 text-xs break-all">
          &#9888; {error}
        </div>
      )}

      {/* Success */}
      {txSignature && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-800 rounded-xl">
          <p className="text-green-400 text-xs mb-1">&#10003; Transaction confirmed!</p>
          
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 text-xs underline break-all"
          >
            View on Solana Explorer
          </a>
        </div>
      )}
    </div>
  );
}

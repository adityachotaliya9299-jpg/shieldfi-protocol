"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navbar } from "../components/Navbar";
import { PoolStats } from "../components/PoolStats";
import { PositionCard } from "../components/PositionCard";
import { ActionPanel } from "../components/ActionPanel";
import { useShieldFi } from "../lib/useShieldFi";

export default function Home() {
  const { connected } = useWallet();
  const {
    poolData, positionData,
    txLoading, error, txSignature,
    deposit, withdraw, borrow, repay,
  } = useShieldFi();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-gray-900/30 
                      border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-800 
                          rounded-full px-4 py-1.5 text-blue-400 text-sm mb-4">
            🛡️ Security-First DeFi on Solana
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Lend & Borrow with
            <span className="text-blue-400"> Confidence</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Overcollateralized lending with emergency pause, oracle guards,
            and real-time health factor monitoring.
          </p>

          {/* Security Badges */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {[
              "⚡ Emergency Pause",
              "🔮 Pyth Oracle",
              "🔐 PDA Vault",
              "📊 Health Factor",
              "🛡️ Overflow-Safe Math",
            ].map((badge) => (
              <span
                key={badge}
                className="px-3 py-1 bg-gray-800 border border-gray-700 
                           rounded-full text-xs text-gray-400"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Pool Stats — full width */}
        <div className="mb-6">
          <PoolStats pool={poolData} />
        </div>

        {/* Action + Position side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActionPanel
            onDeposit={deposit}
            onWithdraw={withdraw}
            onBorrow={borrow}
            onRepay={repay}
            txLoading={txLoading}
            error={error}
            txSignature={txSignature}
          />
          {connected ? (
            <PositionCard position={positionData} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 
                            flex flex-col items-center justify-center text-center">
              <span className="text-5xl mb-4">🔌</span>
              <h3 className="text-lg font-semibold text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-500 text-sm">
                Connect Phantom or Solflare to view your position 
                and start lending.
              </p>
            </div>
          )}
        </div>

        {/* Security Info Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "🔮",
              title: "Pyth Oracle",
              desc: "Real-time price feeds with staleness + confidence interval guards.",
            },
            {
              icon: "⏸️",
              title: "Circuit Breaker",
              desc: "Admin can pause all operations instantly during an exploit or incident.",
            },
            {
              icon: "🔐",
              title: "Two-Step Auth",
              desc: "Authority transfer requires confirmation from the new owner to prevent lockout.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
            >
              <span className="text-2xl">{item.icon}</span>
              <h4 className="font-semibold text-white mt-2 mb-1">{item.title}</h4>
              <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

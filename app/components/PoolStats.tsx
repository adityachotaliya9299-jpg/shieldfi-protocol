"use client";
import { PoolData } from "../lib/useShieldFi";

interface Props {
  pool: PoolData | null;
}

export function PoolStats({ pool }: Props) {
  if (!pool) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Pool Stats</h2>
        <p className="text-gray-500 text-sm">Pool not initialized yet.</p>
      </div>
    );
  }

  const stats = [
    { label: "Total Deposits", value: `$${pool.totalDeposits}`, color: "text-green-400" },
    { label: "Total Borrows", value: `$${pool.totalBorrows}`, color: "text-yellow-400" },
    { label: "Utilization", value: pool.utilizationRate, color: "text-blue-400" },
    { label: "Collateral Factor", value: pool.collateralFactor, color: "text-purple-400" },
    { label: "Liq. Threshold", value: pool.liquidationThreshold, color: "text-orange-400" },
    {
      label: "Status",
      value: pool.isPaused ? "⏸ Paused" : "✅ Active",
      color: pool.isPaused ? "text-red-400" : "text-green-400",
    },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-300">
        USDC Pool Stats
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-800/50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

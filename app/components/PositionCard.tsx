"use client";
import { PositionData } from "../lib/useShieldFi";

interface Props {
  position: PositionData | null;
}

export function PositionCard({ position }: Props) {
  if (!position) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-300">
          Your Position
        </h2>
        <p className="text-gray-500 text-sm">
          No position found. Deposit to get started.
        </p>
      </div>
    );
  }

  const healthNum = position.healthFactor === "∞"
    ? 999
    : parseFloat(position.healthFactor);

  const healthColor =
    healthNum > 150
      ? "text-green-400"
      : healthNum > 120
      ? "text-yellow-400"
      : "text-red-400";

  const healthBarWidth =
    position.healthFactor === "∞" ? 100 : Math.min(healthNum / 2, 100);

  const healthBarColor =
    healthNum > 150
      ? "bg-green-500"
      : healthNum > 120
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-300">
        Your Position
      </h2>

      {/* Health Factor Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Health Factor</span>
          <span className={`text-lg font-bold ${healthColor}`}>
            {position.healthFactor}
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${healthBarColor}`}
            style={{ width: `${healthBarWidth}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Liquidation occurs when health &lt; 1.00
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Deposited</p>
          <p className="text-base font-bold text-green-400">
            ${position.depositedAmount}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Borrowed</p>
          <p className="text-base font-bold text-yellow-400">
            ${position.borrowedAmount}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Interest Owed</p>
          <p className="text-base font-bold text-orange-400">
            ${position.accruedInterest}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Max Borrow</p>
          <p className="text-base font-bold text-blue-400">
            ${position.maxBorrow}
          </p>
        </div>
      </div>
    </div>
  );
}

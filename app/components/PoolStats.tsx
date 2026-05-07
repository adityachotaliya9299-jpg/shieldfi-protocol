"use client";
import { useEffect, useState } from "react";
import { PoolData } from "../lib/useShieldFi";

interface Props { poolData: PoolData | null; }

function AnimNumber({ value, prefix = "" }: { value: string; prefix?: string }) {
  const [disp, setDisp] = useState("0.00");
  useEffect(() => {
    const n = parseFloat(value.replace(/,/g, ""));
    if (isNaN(n)) { setDisp(value); return; }
    let v = 0;
    const inc = n / (1200 / 16);
    const t = setInterval(() => {
      v += inc;
      if (v >= n) { setDisp(value); clearInterval(t); return; }
      setDisp(v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <span>{prefix}{disp}</span>;
}

// Each stat card is its own component — hooks outside map
function StatCard({ label, value, prefix, color, icon, desc, animated, delay }: {
  label: string; value: string; prefix: string; color: string;
  icon: string; desc: string; animated: boolean; delay: number;
}) {
  const [hov, setHov] = useState(false);
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 16px", borderRadius: 12, cursor: "default",
        background: hov ? `${color}0a` : "rgba(5,10,30,0.55)",
        border: hov ? `1px solid ${color}45` : "1px solid rgba(99,149,255,0.1)",
        boxShadow: hov ? `0 4px 20px ${color}15` : "none",
        transition: "all 0.25s ease",
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(16px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: "#3a4f7a", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1rem", fontWeight: 700, color }}>
        {animated ? <AnimNumber value={value} prefix={prefix} /> : value}
      </div>
      <div style={{ fontSize: 10, color: "#3a4f7a", marginTop: 4 }}>{desc}</div>
    </div>
  );
}

const STATS = [
  { key: "totalDeposits",       label: "Total Deposits",    prefix: "$", color: "#00e5ff", icon: "⬆", desc: "Value locked",    animated: true  },
  { key: "totalBorrows",        label: "Active Borrows",    prefix: "$", color: "#ff6b35", icon: "⬇", desc: "Outstanding",     animated: true  },
  { key: "utilizationRate",     label: "Utilization",       prefix: "",  color: "#ffd600", icon: "◈", desc: "Pool usage",      animated: false },
  { key: "collateralFactor",    label: "Collateral Factor", prefix: "",  color: "#00ff88", icon: "◆", desc: "Max borrow ratio", animated: false },
  { key: "liquidationThreshold",label: "Liq. Threshold",   prefix: "",  color: "#a78bfa", icon: "⚡", desc: "Trigger point",   animated: false },
];

export default function PoolStats({ poolData }: Props) {
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 150); }, []);

  const card: React.CSSProperties = {
    background: "rgba(10,18,45,0.75)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(99,149,255,0.2)",
    borderRadius: 16,
    overflow: "hidden",
    transition: "opacity 0.6s ease",
    opacity: vis ? 1 : 0,
  };

  if (!poolData) {
    return (
      <div style={card}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(99,149,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ffd600" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#ffd600", letterSpacing: "0.1em" }}>LOADING POOL DATA...</span>
        </div>
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, border: "1px solid rgba(99,149,255,0.06)" }}>
              <div style={{ height: 10, borderRadius: 4, background: "rgba(99,149,255,0.1)", marginBottom: 12, width: "60%" }} />
              <div style={{ height: 20, borderRadius: 4, background: "rgba(99,149,255,0.08)", width: "80%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(99,149,255,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.22)" }}>📊</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#e8f0ff" }}>USDC Lending Pool</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#3a4f7a", marginTop: 1 }}>Ro1PcDc3...FyBD</div>
          </div>
        </div>
        {poolData.isPaused ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 99, background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff3b5c" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ff3b5c", letterSpacing: "0.08em" }}>PAUSED</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 99, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.28)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#00ff88", letterSpacing: "0.08em" }}>ACTIVE</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {STATS.map((s, i) => (
          <StatCard
            key={s.key}
            label={s.label}
            value={poolData[s.key as keyof PoolData] as string}
            prefix={s.prefix}
            color={s.color}
            icon={s.icon}
            desc={s.desc}
            animated={s.animated}
            delay={i * 80}
          />
        ))}
      </div>

      {/* Rate limit bar */}
      <div style={{ padding: "0 24px 20px" }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,107,53,0.07)", border: "1px solid rgba(255,107,53,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b35", letterSpacing: "0.08em" }}>⚡ RATE LIMIT GUARD</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6e84b8" }}>10% max per slot</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "10%", background: "linear-gradient(90deg, #ff6b35, #ff3b5c)", borderRadius: 99, boxShadow: "0 0 8px rgba(255,107,53,0.5)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#3a4f7a" }}>$500 max drain / slot</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#3a4f7a" }}>of $5,000 pool</span>
          </div>
        </div>
      </div>
    </div>
  );
}
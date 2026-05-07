"use client";
import { useEffect, useState } from "react";
import { PositionData } from "../lib/useShieldFi";
import { useWallet } from "@solana/wallet-adapter-react";

interface Props { positionData: PositionData | null; }

function MetricCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "12px 14px", borderRadius: 10, cursor: "default", transition: "all 0.25s ease", background: hov ? `${color}08` : "rgba(5,10,30,0.5)", border: hov ? `1px solid ${color}35` : "1px solid rgba(99,149,255,0.1)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "#3a4f7a", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.95rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function PositionCard({ positionData }: Props) {
  const { publicKey } = useWallet();
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 400); }, []);

  const card: React.CSSProperties = {
    background: "rgba(10,18,45,0.75)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(99,149,255,0.2)", borderRadius: 16, overflow: "hidden",
    transition: "all 0.6s ease", opacity: vis ? 1 : 0,
    transform: vis ? "translateY(0)" : "translateY(20px)",
  };

  if (!publicKey) return (
    <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 48, gap: 18, minHeight: 300 }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)" }}>🔐</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#e8f0ff", marginBottom: 6 }}>Connect Wallet</div>
        <div style={{ fontSize: 13, color: "#3a4f7a", lineHeight: 1.5 }}>Connect your wallet to view position</div>
      </div>
    </div>
  );

  if (!positionData) return (
    <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 48, gap: 18, minHeight: 300 }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)" }}>📊</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#e8f0ff", marginBottom: 6 }}>No Position Yet</div>
        <div style={{ fontSize: 13, color: "#3a4f7a", lineHeight: 1.5 }}>Deposit USDC to start earning</div>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, padding: "4px 14px", borderRadius: 99, background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.15)", color: "#6e84b8" }}>
        {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-6)}
      </div>
    </div>
  );

  const h = positionData.healthFactor === "∞" ? 999 : parseFloat(positionData.healthFactor);
  const hPct = Math.min((h / 20) * 100, 100);
  const hColor = h > 5 ? "#00ff88" : h > 1.5 ? "#ffd600" : "#ff3b5c";
  const hLabel = h > 5 ? "Healthy" : h > 1.5 ? "At Risk" : "Danger";
  const hGrad = h > 5 ? "linear-gradient(90deg,#00ff88,#00e5ff)" : h > 1.5 ? "linear-gradient(90deg,#ffd600,#ff6b35)" : "linear-gradient(90deg,#ff3b5c,#ff6b35)";

  return (
    <div style={card}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(99,149,255,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.2)" }}>👤</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#e8f0ff" }}>Your Position</span>
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#3a4f7a" }}>{publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}</span>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#6e84b8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Health Factor</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.3rem", fontWeight: 700, color: hColor }}>{positionData.healthFactor}</span>
              <div style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", background: `${hColor}18`, border: `1px solid ${hColor}40`, color: hColor }}>{hLabel}</div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${hPct}%`, background: hGrad, borderRadius: 99, boxShadow: `0 0 10px ${hColor}50`, transition: "width 1.2s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: "#3a4f7a" }}>Liquidation at &lt; 1.00</span>
            <span style={{ fontSize: 10, color: "#3a4f7a" }}>Safe &gt; 2.00</span>
          </div>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(99,149,255,0.15), transparent)" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricCard label="Deposited"    value={`$${positionData.depositedAmount}`}  color="#00e5ff" icon="⬆" />
          <MetricCard label="Borrowed"     value={`$${positionData.borrowedAmount}`}   color="#ff6b35" icon="⬇" />
          <MetricCard label="Interest"     value={`$${positionData.accruedInterest}`}  color="#ffd600" icon="%" />
          <MetricCard label="Max Borrow"   value={`$${positionData.maxBorrow}`}        color="#00ff88" icon="◆" />
        </div>

        <a href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`} target="_blank" rel="noreferrer"
          style={{ display: "flex", justifyContent: "center", padding: "10px", borderRadius: 10, fontSize: 11, fontWeight: 600, textDecoration: "none", color: "#6e84b8", background: "rgba(99,149,255,0.05)", border: "1px solid rgba(99,149,255,0.12)", transition: "all 0.2s ease" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#e8f0ff"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6e84b8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.12)"; }}
        >↗ View on Solana Explorer</a>
      </div>
    </div>
  );
}
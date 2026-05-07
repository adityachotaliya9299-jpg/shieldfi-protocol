"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Props {
  onDeposit: (n: number) => void;
  onWithdraw: (n: number) => void;
  onBorrow: (n: number) => void;
  onRepay: (n: number) => void;
  txLoading: boolean;
  txSignature: string | null;
  error: string | null;
}

const TABS = [
  { id:"deposit",  label:"Deposit",  color:"#00e5ff", icon:"⬆", desc:"Supply USDC as collateral to earn yield and unlock borrowing power." },
  { id:"withdraw", label:"Withdraw", color:"#a78bfa", icon:"⬇", desc:"Remove deposited USDC. Health factor must remain above 1.0." },
  { id:"borrow",   label:"Borrow",   color:"#ff6b35", icon:"◈", desc:"Borrow against your collateral. Max 75% of deposit value." },
  { id:"repay",    label:"Repay",    color:"#00ff88", icon:"◆", desc:"Repay outstanding USDC loan. Interest is cleared first." },
];

const AMOUNTS = [10, 50, 100, 500];

export default function ActionPanel({ onDeposit, onWithdraw, onBorrow, onRepay, txLoading, txSignature, error }: Props) {
  const { publicKey } = useWallet();
  const [tab, setTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const active = TABS.find(t => t.id === tab)!;

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const fns: Record<string, (n: number) => void> = { deposit: onDeposit, withdraw: onWithdraw, borrow: onBorrow, repay: onRepay }; fns[tab]?.(n);
  };

  return (
    <div style={{
      background: "rgba(10,18,45,0.75)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(99,149,255,0.2)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(99,149,255,0.12)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setAmount(""); }}
            style={{
              flex:1, padding:"14px 0", fontSize:13, fontWeight:700,
              fontFamily:"'Space Grotesk', sans-serif",
              cursor:"pointer", border:"none", outline:"none",
              transition:"all 0.25s ease",
              color: tab === t.id ? t.color : "#3a4f7a",
              background: tab === t.id ? `${t.color}0e` : "transparent",
              borderBottom: tab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
              letterSpacing:"0.02em",
            }}
          >
            <span style={{ marginRight:5, fontSize:14 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
        {/* Description */}
        <p style={{ fontSize:13, color:"#6e84b8", lineHeight:1.55, margin:0 }}>{active.desc}</p>

        {/* Amount input */}
        <div>
          <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#3a4f7a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>
            Amount
          </label>
          <div style={{ position:"relative" }}>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                width:"100%", padding:"14px 64px 14px 16px", borderRadius:12,
                fontFamily:"'DM Mono', monospace", fontSize:"1.1rem",
                background:"rgba(5,8,24,0.65)", border:"1px solid rgba(99,149,255,0.2)",
                color:"#e8f0ff", outline:"none", boxSizing:"border-box",
                transition:"border-color 0.2s ease",
              }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = `${active.color}60`}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(99,149,255,0.2)"}
            />
            <div style={{
              position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
              padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:700,
              background:`${active.color}15`, border:`1px solid ${active.color}30`,
              color:active.color, letterSpacing:"0.04em",
            }}>USDC</div>
          </div>
        </div>

        {/* Quick amounts */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {AMOUNTS.map(n => (
            <button key={n} onClick={() => setAmount(String(n))}
              style={{
                padding:"9px 0", borderRadius:9, fontSize:13, fontWeight:600,
                fontFamily:"'Space Grotesk', sans-serif",
                cursor:"pointer", transition:"all 0.2s ease",
                background: amount === String(n) ? `${active.color}14` : "transparent",
                border: amount === String(n) ? `1px solid ${active.color}50` : "1px solid rgba(99,149,255,0.15)",
                color: amount === String(n) ? active.color : "#6e84b8",
              }}
              onMouseEnter={e => {
                if (amount !== String(n)) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.35)";
                  (e.currentTarget as HTMLElement).style.color = "#e8f0ff";
                }
              }}
              onMouseLeave={e => {
                if (amount !== String(n)) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.15)";
                  (e.currentTarget as HTMLElement).style.color = "#6e84b8";
                }
              }}
            >${n}</button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!publicKey || txLoading || !amount}
          style={{
            width:"100%", padding:"15px", borderRadius:12,
            fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:15,
            letterSpacing:"0.03em", cursor: !publicKey || txLoading || !amount ? "not-allowed" : "pointer",
            transition:"all 0.3s ease",
            background: !publicKey || !amount ? "rgba(99,149,255,0.05)" : `linear-gradient(135deg, ${active.color}22, ${active.color}0e)`,
            border: `1px solid ${!publicKey || !amount ? "rgba(99,149,255,0.12)" : active.color + "55"}`,
            color: !publicKey || !amount ? "#3a4f7a" : active.color,
          }}
          onMouseEnter={e => {
            if (publicKey && amount && !txLoading) {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${active.color}22`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          {txLoading ? (
            <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span style={{ display:"inline-block", width:16, height:16, border:"2px solid rgba(0,229,255,0.25)", borderTopColor:"#00e5ff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
              Processing...
            </span>
          ) : !publicKey ? "Connect Wallet" : `${active.label}${amount ? ` $${amount}` : ""} USDC`}
        </button>

        {/* Success */}
        {txSignature && (
          <div style={{ padding:"12px 14px", borderRadius:10, display:"flex", alignItems:"flex-start", gap:10, background:"rgba(0,255,136,0.07)", border:"1px solid rgba(0,255,136,0.22)", animation:"fadeIn 0.4s ease" }}>
            <span style={{ color:"#00ff88", marginTop:1 }}>✅</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#00ff88", marginBottom:3 }}>Transaction confirmed</div>
              <a href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noreferrer"
                style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#3a4f7a", textDecoration:"none", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {txSignature.slice(0, 24)}... ↗
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding:"12px 14px", borderRadius:10, display:"flex", alignItems:"flex-start", gap:10, background:"rgba(255,59,92,0.07)", border:"1px solid rgba(255,59,92,0.22)", animation:"fadeIn 0.4s ease" }}>
            <span style={{ color:"#ff3b5c", marginTop:1 }}>⚠</span>
            <div style={{ fontSize:12, color:"#ff3b5c", lineHeight:1.5 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
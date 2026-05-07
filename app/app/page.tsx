"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import PoolStats from "../components/PoolStats";
import PositionCard from "../components/PositionCard";
import ActionPanel from "../components/ActionPanel";
import { useShieldFi } from "../lib/useShieldFi";

const Navbar = dynamic(() => import("../components/Navbar"), { ssr: false });

const CARD = {
  background: "rgba(10, 18, 45, 0.7)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(99, 149, 255, 0.15)",
  borderRadius: 16,
};

const CARD_BRIGHT = {
  background: "rgba(10, 22, 55, 0.8)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(99, 149, 255, 0.25)",
  borderRadius: 16,
};

function Badge({ icon, label, i }: { icon: string; label: string; i: number }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 14px", borderRadius: 99,
      background: "rgba(99,149,255,0.06)",
      border: "1px solid rgba(99,149,255,0.18)",
      fontSize: 12, color: "#9fa8da", fontWeight: 500,
      letterSpacing: "0.04em",
      animation: "fadeUp 0.7s ease forwards",
      animationDelay: `${400 + i * 80}ms`,
      opacity: 0,
    }}>
      <span>{icon}</span><span>{label}</span>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: "1.9rem", fontWeight: 700,
        background: "linear-gradient(135deg, #00e5ff, #00ff88)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}>{value}</div>
      <div style={{ fontSize: 10, color: "#3a4f7a", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function DefenseRow({ exploit, defense, example, i }: { exploit: string; defense: string; example: string; i: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
        borderRadius: 12, cursor: "default",
        background: hovered ? "rgba(0,229,255,0.04)" : "rgba(5,10,30,0.5)",
        border: hovered ? "1px solid rgba(0,229,255,0.2)" : "1px solid rgba(99,149,255,0.1)",
        transition: "all 0.25s ease",
        animation: "fadeUp 0.6s ease forwards",
        animationDelay: `${i * 80}ms`,
        opacity: 0,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.25)",
        fontSize: 12, color: "#ff3b5c", marginTop: 2,
      }}>✕</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#e8f0ff", marginBottom: 2 }}>{exploit}</div>
        <div style={{ fontSize: 11, color: "#3a4f7a", marginBottom: 8 }}>{example}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.35)",
            fontSize: 10, color: "#00ff88",
          }}>✓</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#00ff88" }}>{defense}</span>
        </div>
      </div>
    </div>
  );
}

function LayerRow({ icon, label, sub, color, i }: { icon: string; label: string; sub: string; color: string; i: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      animation: "fadeUp 0.6s ease forwards",
      animationDelay: `${i * 70}ms`,
      opacity: 0,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        background: `${color}12`, border: `1px solid ${color}30`,
        transition: "transform 0.2s ease",
        transform: hovered ? "scale(1.1)" : "scale(1)",
      }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >{icon}</div>
      <div style={{
        flex: 1, padding: "10px 14px", borderRadius: 12,
        background: hovered ? `${color}06` : "rgba(5,10,30,0.5)",
        border: hovered ? `1px solid ${color}30` : "1px solid rgba(99,149,255,0.08)",
        transition: "all 0.25s ease", cursor: "default",
      }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#3a4f7a" }}>{sub}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const { poolData, positionData, txLoading, error, txSignature, deposit, withdraw, borrow, repay } = useShieldFi();
  const dashboardRef = useRef<HTMLDivElement>(null);

  const scrollToDash = () => dashboardRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050818", fontFamily: "'Space Grotesk', sans-serif", color: "#e8f0ff", overflowX: "hidden" }}>

      {/* Keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes glow-pulse { 0%,100%{box-shadow:0 0 20px rgba(0,229,255,0.2)} 50%{box-shadow:0 0 40px rgba(0,229,255,0.5)} }
        @keyframes health-in { from{width:0} to{width:var(--w)} }
        @keyframes orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,25px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0a1128} ::-webkit-scrollbar-thumb{background:rgba(99,149,255,0.3);border-radius:2px}
      `}</style>

      {/* BG orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,80,255,0.1) 0%, transparent 70%)", top:-200, left:-200, animation:"orb1 22s ease-in-out infinite", filter:"blur(60px)" }} />
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,229,255,0.07) 0%, transparent 70%)", top:300, right:-100, animation:"orb2 28s ease-in-out infinite", filter:"blur(60px)" }} />
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 70%)", bottom:100, left:"45%", animation:"orb1 35s ease-in-out infinite reverse", filter:"blur(60px)" }} />
        {/* Grid */}
        <div style={{ position:"absolute", inset:0, opacity:0.035, backgroundImage:"linear-gradient(rgba(99,149,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,149,255,1) 1px, transparent 1px)", backgroundSize:"60px 60px" }} />
      </div>

      <Navbar />

      {/* ── HERO ── */}
      <section style={{ position:"relative", zIndex:1, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"100px 24px 60px" }}>

        {/* Top pill */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:8,
          padding:"7px 18px", borderRadius:99, marginBottom:28,
          background:"rgba(0,229,255,0.08)", border:"1px solid rgba(0,229,255,0.22)",
          animation:"fadeUp 0.6s ease 0.1s forwards", opacity:0,
        }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#00e5ff", animation:"pulse-dot 2s ease infinite" }} />
          <span style={{ fontSize:11, fontWeight:700, color:"#00e5ff", letterSpacing:"0.14em" }}>SECURITY-FIRST DEFI ON SOLANA</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize:"clamp(2.6rem, 6vw, 5.2rem)", fontWeight:800,
          lineHeight:1.08, letterSpacing:"-0.025em",
          maxWidth:900, marginBottom:20,
          animation:"fadeUp 0.7s ease 0.2s forwards", opacity:0,
        }}>
          Lend & Borrow with{" "}
          <span style={{ background:"linear-gradient(135deg, #00e5ff 0%, #00ff88 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
            Confidence
          </span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize:17, color:"#6e84b8", maxWidth:560, lineHeight:1.65, marginBottom:32, animation:"fadeUp 0.7s ease 0.35s forwards", opacity:0 }}>
          Overcollateralized lending with emergency pause, oracle guards, rate-limited withdrawals, and real-time health factor monitoring.
        </p>

        {/* Badges */}
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:8, marginBottom:40 }}>
          {[["⚡","Emergency Pause"],["🔮","Oracle Guards"],["📊","Rate Limit Guard"],["❤","Health Factor"],["➗","Safe Math"],["🔐","PDA Vault"]].map(([icon, label], i) => (
            <Badge key={label} icon={icon} label={label} i={i} />
          ))}
        </div>

        {/* Stats row */}
        <div style={{
          display:"flex", flexWrap:"wrap", justifyContent:"center", gap:48,
          marginBottom:44, padding:"24px 48px",
          borderRadius:16,
          background:"rgba(10,18,45,0.6)",
          border:"1px solid rgba(99,149,255,0.15)",
          backdropFilter:"blur(12px)",
          animation:"fadeUp 0.7s ease 0.55s forwards", opacity:0,
        }}>
          <HeroStat value={poolData?.totalDeposits ? `$${poolData.totalDeposits}` : "$5,000.00"} label="Total Deposits" />
          <div style={{ width:1, background:"rgba(99,149,255,0.15)" }} />
          <HeroStat value="10/10" label="Tests Passing" />
          <div style={{ width:1, background:"rgba(99,149,255,0.15)" }} />
          <HeroStat value="7" label="Security Features" />
          <div style={{ width:1, background:"rgba(99,149,255,0.15)" }} />
          <HeroStat value="10%" label="Max Drain/Slot" />
        </div>

        {/* CTAs */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", justifyContent:"center", animation:"fadeUp 0.7s ease 0.7s forwards", opacity:0 }}>
          <button onClick={scrollToDash} style={{
            padding:"14px 36px", borderRadius:12, fontWeight:700, fontSize:15,
            cursor:"pointer", fontFamily:"'Space Grotesk', sans-serif",
            background:"linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,255,136,0.1))",
            border:"1px solid rgba(0,229,255,0.45)", color:"#00e5ff",
            letterSpacing:"0.03em", transition:"all 0.25s ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(0,229,255,0.28)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >Launch App ↓</button>

          <a href="https://github.com/adityachotaliya9299-jpg/shieldfi-protocol" target="_blank" rel="noreferrer" style={{
            padding:"14px 36px", borderRadius:12, fontWeight:700, fontSize:15, textDecoration:"none",
            fontFamily:"'Space Grotesk', sans-serif",
            background:"transparent", border:"1px solid rgba(99,149,255,0.25)", color:"#9fa8da",
            letterSpacing:"0.03em", transition:"all 0.25s ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.5)"; (e.currentTarget as HTMLElement).style.color = "#e8f0ff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,149,255,0.25)"; (e.currentTarget as HTMLElement).style.color = "#9fa8da"; }}
          >View Source ↗</a>
        </div>

        {/* Scroll hint */}
        <div style={{ position:"absolute", bottom:32, left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:6, opacity:0.35, animation:"floatY 3s ease-in-out infinite" }}>
          <span style={{ fontSize:9, letterSpacing:"0.14em", color:"#3a4f7a" }}>SCROLL</span>
          <div style={{ width:1, height:32, background:"linear-gradient(to bottom, rgba(99,149,255,0.5), transparent)" }} />
        </div>
      </section>

      {/* ── EXPLOIT → DEFENSE ── */}
      <section style={{ position:"relative", zIndex:1, padding:"80px 24px", maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:99, marginBottom:16, background:"rgba(255,59,92,0.08)", border:"1px solid rgba(255,59,92,0.2)", fontSize:12, color:"#ff3b5c", fontWeight:600 }}>
            <span>⚠</span><span>Threat Model</span>
          </div>
          <h2 style={{ fontSize:"2.2rem", fontWeight:800, letterSpacing:"-0.02em", color:"#e8f0ff", marginBottom:14 }}>
            Every Exploit Has a{" "}
            <span style={{ background:"linear-gradient(135deg, #00e5ff, #00ff88)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Defense</span>
          </h2>
          <p style={{ color:"#6e84b8", maxWidth:480, margin:"0 auto", lineHeight:1.6, fontSize:15 }}>
            ShieldFi systematically eliminates the top DeFi attack vectors.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(460px, 1fr))", gap:12 }}>
          {[
            { exploit:"Flash Loan Drain", example:"Drain entire pool in one block", defense:"10% rate limit per slot — caps blast radius" },
            { exploit:"Oracle Manipulation", example:"Mango Markets $114M exploit", defense:"Confidence + staleness + address verification" },
            { exploit:"Admin Key Compromise", example:"Single key = full protocol control", defense:"Two-step authority transfer — new admin must sign" },
            { exploit:"Integer Overflow", example:"Steal beyond actual balance", defense:"Rust checked_* math — MathOverflow on any fail" },
            { exploit:"No Circuit Breaker", example:"Exploit runs for hours undetected", defense:"Global pause — halts ALL operations instantly" },
            { exploit:"Full Liquidation Abuse", example:"100% collateral seized in one tx", defense:"50% partial cap — borrowers can recapitalize" },
          ].map((d, i) => <DefenseRow key={d.exploit} {...d} i={i} />)}
        </div>
      </section>

      {/* ── DASHBOARD ── */}
      <section ref={dashboardRef} style={{ position:"relative", zIndex:1, padding:"60px 24px 80px", maxWidth:1200, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:99, marginBottom:12, background:"rgba(0,229,255,0.07)", border:"1px solid rgba(0,229,255,0.18)", fontSize:12, color:"#00e5ff", fontWeight:600 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00e5ff", animation:"pulse-dot 2s ease infinite" }} />
            <span>Live Dashboard</span>
          </div>
          <h2 style={{ fontSize:"2rem", fontWeight:800, letterSpacing:"-0.02em", color:"#e8f0ff" }}>Protocol Dashboard</h2>
        </div>

        <div style={{ marginBottom:20 }}>
          <PoolStats poolData={poolData} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <ActionPanel onDeposit={deposit} onWithdraw={withdraw} onBorrow={borrow} onRepay={repay} txLoading={txLoading} txSignature={txSignature} error={error} />
          <PositionCard positionData={positionData} />
        </div>
      </section>

      {/* ── DEFENSE IN DEPTH ── */}
      <section style={{ position:"relative", zIndex:1, padding:"60px 24px 80px", maxWidth:700, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h2 style={{ fontSize:"2rem", fontWeight:800, letterSpacing:"-0.02em", color:"#e8f0ff", marginBottom:12 }}>
            Defense-in-<span style={{ background:"linear-gradient(135deg,#00e5ff,#00ff88)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Depth</span>
          </h2>
          <p style={{ color:"#6e84b8", fontSize:14, lineHeight:1.6 }}>Every action passes 6 security layers before any state changes.</p>
        </div>

        <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:12 }}>
          {/* Vertical line */}
          <div style={{ position:"absolute", left:22, top:22, bottom:22, width:1, background:"linear-gradient(to bottom, rgba(0,229,255,0.4), rgba(0,255,136,0.1))", zIndex:0 }} />

          {[
            { icon:"👤", label:"User Action", sub:"deposit / borrow / withdraw / repay", color:"#6e84b8" },
            { icon:"✅", label:"Input Validation", sub:"Zero amount guard · overflow-safe parsing", color:"#00e5ff" },
            { icon:"⏸", label:"Circuit Breaker", sub:"is_paused → halts ALL operations instantly", color:"#ff3b5c" },
            { icon:"📊", label:"Rate Limit Guard", sub:"Max 10% per slot — caps exploit blast radius", color:"#ff6b35" },
            { icon:"🔮", label:"Oracle Verification", sub:"Staleness · confidence · address match", color:"#ffd600" },
            { icon:"❤", label:"Health Factor Check", sub:"Collateral factor gating on all outflows", color:"#00ff88" },
            { icon:"🔐", label:"PDA Vault Transfer", sub:"Program-derived authority · no hot wallet", color:"#a78bfa" },
          ].map((l, i) => <LayerRow key={l.label} {...l} i={i} />)}

          {/* Final */}
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, zIndex:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, background:"rgba(0,255,136,0.12)", border:"1px solid rgba(0,255,136,0.4)", boxShadow:"0 0 20px rgba(0,255,136,0.2)" }}>✅</div>
            <div style={{ flex:1, padding:"10px 14px", borderRadius:12, background:"rgba(0,255,136,0.06)", border:"1px solid rgba(0,255,136,0.22)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#00ff88" }}>State Updated</div>
              <div style={{ fontSize:11, color:"#3a4f7a" }}>Transaction confirmed on Solana</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ position:"relative", zIndex:1, padding:"32px 24px", borderTop:"1px solid rgba(99,149,255,0.1)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,229,255,0.1)", border:"1px solid rgba(0,229,255,0.2)", fontSize:14 }}>🛡</div>
            <span style={{ fontWeight:700, color:"#e8f0ff" }}>Shield<span style={{ color:"#00e5ff" }}>Fi</span></span>
            <div style={{ padding:"2px 10px", borderRadius:99, background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.2)", fontSize:10, color:"#00ff88", fontWeight:700 }}>DEVNET</div>
          </div>
          <div style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#3a4f7a" }}>
            3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM
          </div>
          <div style={{ display:"flex", gap:24 }}>
            {[["GitHub","https://github.com/adityachotaliya9299-jpg/shieldfi-protocol"],["Explorer","https://explorer.solana.com/address/3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM?cluster=devnet"]].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{ fontSize:13, color:"#6e84b8", textDecoration:"none", fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", transition:"color 0.2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#e8f0ff"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6e84b8"}
              >{label}</a>
            ))}
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:11, color:"#3a4f7a" }}>
          Built for Solana Frontier Hackathon 2026 · Adevar Labs Security Audit Bounty · 10/10 tests on Devnet
        </div>
      </footer>
    </div>
  );
}
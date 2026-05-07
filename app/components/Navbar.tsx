"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(m => m.WalletMultiButton),
  { ssr: false }
);

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      transition: "all 0.4s ease",
      background: scrolled ? "rgba(5,8,24,0.88)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(99,149,255,0.1)" : "none",
    }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
            background:"linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,255,136,0.08))",
            border:"1px solid rgba(0,229,255,0.38)",
            boxShadow:"0 0 18px rgba(0,229,255,0.18)",
          }}>🛡</div>
          <span style={{ fontWeight:800, fontSize:17, letterSpacing:"-0.01em", color:"#e8f0ff", fontFamily:"'Space Grotesk', sans-serif" }}>
            Shield<span style={{ color:"#00e5ff" }}>Fi</span>
          </span>
        </div>

        {/* Links */}
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          {[
            { label:"Dashboard", href:"#" },
            { label:"GitHub", href:"https://github.com/adityachotaliya9299-jpg/shieldfi-protocol" },
          ].map(link => (
            <a key={link.label} href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noreferrer" : undefined}
              style={{ fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", textDecoration:"none", color:"#6e84b8", transition:"color 0.2s ease", fontFamily:"'Space Grotesk', sans-serif" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#e8f0ff"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6e84b8"}
            >{link.label}</a>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Devnet badge */}
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:99, background:"rgba(0,255,136,0.07)", border:"1px solid rgba(0,255,136,0.22)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", animation:"pulse-dot 2s ease infinite" }} />
            <span style={{ fontSize:10, fontWeight:800, color:"#00ff88", letterSpacing:"0.1em" }}>DEVNET</span>
          </div>

          {/* Wallet button */}
          <WalletMultiButton style={{
            background: "linear-gradient(135deg, rgba(0,229,255,0.14), rgba(0,255,136,0.07))",
            border: "1px solid rgba(0,229,255,0.32)",
            borderRadius: 10,
            color: "#00e5ff",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 16px",
            height: "auto",
            lineHeight: 1.5,
            letterSpacing: "0.02em",
            transition: "all 0.25s ease",
          }} />
        </div>
      </div>
    </nav>
  );
}
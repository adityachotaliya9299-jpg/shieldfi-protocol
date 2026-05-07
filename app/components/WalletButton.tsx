"use client";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(m => m.WalletMultiButton),
  { ssr: false }
);

export default function WalletButton() {
  return (
    <WalletMultiButton
      style={{
        background: "linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,255,136,0.08))",
        border: "1px solid rgba(0,229,255,0.35)",
        borderRadius: "10px",
        color: "#00e5ff",
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        fontSize: "13px",
        padding: "8px 16px",
        height: "auto",
        transition: "all 0.25s ease",
      }}
    />
  );
}

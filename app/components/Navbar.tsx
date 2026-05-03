"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="font-bold text-xl text-white">ShieldFi</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/markets" className="hover:text-white transition-colors">
              Markets
            </Link>
            
              href="https://github.com/adityachotaliya9299-jpg/shieldfi-protocol"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !text-sm !h-9 !px-4" />
      </div>
    </nav>
  );
}

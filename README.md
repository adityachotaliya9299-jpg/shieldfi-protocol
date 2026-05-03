# 🛡️ ShieldFi Protocol

> Security-first overcollateralized lending protocol on Solana

Built for the **Solana Frontier Hackathon** | Sponsored by **Adevar Labs**

## Overview

ShieldFi is a DeFi lending protocol that lets users:
- **Deposit** SPL tokens as collateral
- **Borrow** against their collateral (up to the collateral factor)
- **Repay** borrowed positions
- **Liquidate** unhealthy positions for a bonus

## Security Architecture

- ✅ Emergency pause (admin-controlled circuit breaker)
- ✅ Role-based access control via PDA authority
- ✅ Overflow-safe math (`checked_*` operations throughout)
- ✅ Oracle manipulation guards (Phase 3 — Pyth integration)
- ✅ Health factor gating on all borrow operations

## Tech Stack

- **Rust + Anchor** (on-chain program)
- **Solana Devnet**
- **Pyth Network** (price oracles — Phase 3)
- **Next.js + Wallet Adapter** (frontend — Phase 5)

## Build Status

| Phase | Status |
|-------|--------|
| Phase 1: Scaffold + Account Structs | ✅ Done |
| Phase 2: Deposit / Borrow / Repay | ✅ Done |
| Phase 3: Liquidation + Pyth Oracle | ✅ Done |
| Phase 4: Security features | ✅ Done |
| Phase 5: Frontend | ⏳ Pending |
| Phase 6: Tests + Docs | ⏳ Pending |

## Local Setup

\`\`\`bash
# Install dependencies
yarn install

# Build program
anchor build

# Run tests
anchor test
\`\`\`

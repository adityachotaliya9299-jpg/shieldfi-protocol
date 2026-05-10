# ShieldFi Protocol — Hackathon Submission

## Solana Frontier Hackathon | Adevar Labs Bounty Track

---

## Project Overview

ShieldFi is a security-first overcollateralized lending protocol on Solana.
Users deposit SPL tokens as collateral and borrow against them, while the
protocol enforces health factor constraints, oracle price validation, and
emergency controls at every step.

**Category:** DeFi
**Team:** Solo developer
**Chain:** Solana Devnet

---

## Live Links

- GitHub: https://github.com/adityachotaliya9299-jpg/shieldfi-protocol
- Frontend: https://shieldfi-protocol.vercel.app/
- Program ID (devnet): GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun

---

## Why ShieldFi?

DeFi lending protocols lose funds through three main attack vectors:
1. Oracle manipulation — price feeds manipulated to drain collateral
2. Missing access controls — admin functions callable by anyone
3. No emergency response — no way to pause during an active exploit

ShieldFi addresses all three by treating security as a core protocol
requirement, not an afterthought. Every instruction has multiple layers
of validation before any state is mutated.

---

## Technical Architecture

### On-Chain Program (Rust + Anchor 0.29)

**Accounts:**
- LendingPool — one pool per SPL token, PDA seeded by mint address
- UserPosition — per-user collateral and debt tracker, PDA seeded by pool + user
- OraclePriceAccount — price feed with staleness and confidence validation

**Instructions:**
- initialize_pool — creates pool with validated config parameters
- deposit — user sends tokens to PDA-controlled vault
- withdraw — vault sends to user, health factor checked first
- borrow — vault sends to user, collateral factor gating enforced
- repay — user clears debt, interest settled before principal
- liquidate — unhealthy positions can be partially liquidated (50% max per tx)
- pause_protocol / resume_protocol — emergency circuit breaker
- update_pool_config — risk parameter update with validated ranges
- nominate_authority / accept_authority — two-step ownership transfer

### Frontend (Next.js 16 + TypeScript)

Dashboard showing live pool statistics, user health factor with visual
indicator, and action panel for all lending operations.

---

## Security Architecture

### 1. Emergency Circuit Breaker
Admin can pause ALL user operations in a single transaction.
All deposit, withdraw, borrow, repay, and liquidate instructions check
`pool.is_paused` as their first validation step.

### 2. Oracle Manipulation Guards
Custom oracle PDA with:
- Staleness check: rejects price data older than 75 slots (~30 seconds)
- Confidence interval check: rejects feeds where spread exceeds 2% of price
- Oracle address verified against pool state before any price is used
Architecture is designed for Pyth CPI integration on mainnet.

### 3. Overflow-Safe Arithmetic
All math uses checked_add, checked_sub, checked_mul, checked_div.
Explicit MathOverflow error returned on any failure.
No unchecked integer operations anywhere in the codebase.

### 4. Health Factor Gating
- Borrow: blocked if new debt would exceed collateral_factor limit
- Withdraw: blocked if remaining collateral would be under-collateralized
- Liquidation: blocked if health_factor is still safe (>= 1.0)

### 5. Partial Liquidation Only
Maximum 50% of outstanding debt can be liquidated per transaction.
Prevents full collateral seizure in one atomic transaction.
Gives borrowers time to react and add more collateral.

### 6. PDA-Controlled Vault
Protocol vault is owned exclusively by the pool PDA.
No external keypair can sign for vault transfers.
Token transfers are authorized only by program-derived accounts.

### 7. Two-Step Authority Transfer
Current admin nominates a new authority.
New authority must actively sign an accept transaction.
Pending transfer can be cancelled by current authority at any time.
Prevents accidental lockout from typos or wrong addresses.

### 8. Input Validation
All amounts validated > 0 before processing.
Config values validated against safe ranges on both init and update.
Oracle address verified against pool state before price fetch.

---

## Why We Need the Security Audit Credits

ShieldFi is designed to hold real user funds. Before any mainnet
deployment, a professional security audit is essential to verify:

1. The health factor math cannot be gamed through rounding
2. The oracle PDA cannot be replaced with a malicious account
3. The liquidation bonus calculation cannot be exploited
4. No reentrancy vectors exist in the CPI transfer pattern
5. The PDA derivation seeds cannot be front-run

A two-week audit from Adevar Labs would give us the confidence to
deploy safely and the credibility to attract real liquidity.

---

## Build Instructions

\`\`\`bash
# Clone
git clone https://github.com/adityachotaliya9299-jpg/shieldfi-protocol
cd shieldfi-protocol/shieldfi-protocol

# Install Rust deps and build
cargo build-sbf --manifest-path programs/shieldfi/Cargo.toml

# Run tests
anchor test

# Start frontend
cd app && npm run dev
\`\`\`

---

## Deployed Program

Network: Solana Devnet
Program ID: [paste your deployed ID here after anchor deploy]
Explorer: https://explorer.solana.com/address/GVpapxSimmdpcsjgmfU3iWfxWBSz2o9JHc1o3UNq6Pun?cluster=devnet

## Demo Video
https://www.loom.com/share/98b937fd1ef0404988bdb0a1407d0dce

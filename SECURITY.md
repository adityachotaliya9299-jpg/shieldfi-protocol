# ShieldFi Security Architecture

## Overview
ShieldFi is built with a security-first mindset. Every instruction
is gated by multiple layers of validation before any state changes occur.

## Security Features

### 1. Emergency Circuit Breaker
- Admin can pause ALL user operations in a single transaction
- `pause_protocol` / `resume_protocol` instructions
- Every deposit, withdraw, borrow, repay, liquidate checks `is_paused`
- Designed for rapid response to exploits or oracle failures

### 2. Role-Based Access Control
- All admin instructions check `authority == pool.authority` on-chain
- Two-step authority transfer prevents accidental admin lockout:
  - Step 1: Current admin nominates new authority
  - Step 2: New authority must actively accept

### 3. Oracle Manipulation Guards (Pyth)
- Staleness check: rejects price feeds older than 75 slots (~30 seconds)
- Confidence interval check: rejects feeds with >2% spread
- Oracle address verified on-chain against pool's registered oracle
- Prevents flash-loan oracle attacks

### 4. Overflow-Safe Arithmetic
- All math uses `checked_add`, `checked_sub`, `checked_mul`, `checked_div`
- Explicit `MathOverflow` error on any failure
- No unchecked integer operations anywhere in the codebase

### 5. Health Factor Gating
- Borrow: blocked if new debt exceeds collateral_factor limit
- Withdraw: blocked if withdrawal would make position liquidatable
- Liquidation: blocked if health_factor >= 10_000 (position is safe)

### 6. Partial Liquidation Only
- Max 50% of debt can be liquidated in a single transaction
- Prevents full collateral seizure in one atomic transaction
- Gives borrowers time to react and repay

### 7. PDA-Based Vault Authority
- Protocol vault is controlled exclusively by pool PDA
- No external keypair can sign for vault transfers
- Vault authority = pool PDA (program-derived, not a hot wallet)

### 8. Input Validation
- All amounts checked > 0 before processing
- All config values validated against safe ranges on init and update
- Oracle address verified against pool state before price fetch

## Known Limitations (Future Work)
- Interest rate model is simplified — no compound interest yet
- No cross-collateral support (single asset pools only)
- Pyth integration uses devnet feeds — mainnet addresses TBD

## Responsible Disclosure
If you discover a vulnerability, please contact: security@shieldfi.xyz

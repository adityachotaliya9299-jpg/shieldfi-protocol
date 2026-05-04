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

## Rate-Limited Withdrawals and Borrows

### What it does
ShieldFi enforces a per-slot rate limit on how much liquidity can leave
the pool in a single Solana slot (~400ms).

### How it works
- `withdrawal_limit_bps` — set at pool initialization (e.g. 1000 = 10% per slot)
- Every withdraw and borrow is checked against the remaining capacity for the current slot
- If the slot changes, the counter resets — fresh capacity each slot
- The limit applies to BOTH withdrawals and borrows (they share one counter)

### Why this matters
In a typical DeFi exploit, an attacker drains the pool in a single atomic
transaction or a rapid burst of transactions in one block.

With a 10% per slot rate limit on a $1,000,000 pool:
- Maximum drained in 1 slot: $100,000
- An attacker needs 10+ slots (~4 seconds) to fully drain
- This gives the admin time to call pause_protocol and halt the exploit
- The circuit breaker + rate limit work together as a defense-in-depth system

### Configuration
- Minimum: 100 bps (1% per slot) — very restrictive
- Maximum: 5000 bps (50% per slot) — more permissive for large pools
- Recommended: 1000 bps (10% per slot) for most pools

### On-chain verification
The rate limit state is fully on-chain and auditable:
- `pool.withdrawal_limit_bps` — the configured limit
- `pool.rate_limit_slot` — slot of last withdrawal/borrow
- `pool.withdrawn_this_slot` — amount extracted in current slot

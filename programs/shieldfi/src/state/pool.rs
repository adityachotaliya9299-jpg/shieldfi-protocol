use anchor_lang::prelude::*;

/// Slots per year ≈ 78.84M (365 days * 24h * 3600s / 0.4s per slot)
pub const SLOTS_PER_YEAR: u64 = 78_840_000;

#[account]
pub struct LendingPool {
    pub authority: Pubkey,
    pub pending_authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub oracle: Pubkey,

    pub total_deposits: u64,
    pub total_borrows: u64,

    pub reserve_factor: u64,
    pub collateral_factor: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,

    // ── Rate Limit ───────────────────────────────────────────────────
    pub withdrawal_limit_bps: u64,
    pub rate_limit_slot: u64,
    pub withdrawn_this_slot: u64,

    // ── Phase 1: Interest Rate Model ─────────────────────────────────
    /// Current borrow APY in basis points (updated on every interaction)
    /// e.g. 400 = 4% APY, 15000 = 150% APY
    pub borrow_rate_bps: u64,

    /// Cumulative protocol fees collected from borrower interest
    /// reserve_factor% of all interest paid goes here
    pub treasury_accumulated: u64,

    // ────────────────────────────────────────────────────────────────
    pub is_paused: bool,
    pub bump: u8,
}

impl LendingPool {
    pub const LEN: usize = 8   // discriminator
        + 32   // authority
        + 32   // pending_authority
        + 32   // token_mint
        + 32   // token_vault
        + 32   // oracle
        + 8    // total_deposits
        + 8    // total_borrows
        + 8    // reserve_factor
        + 8    // collateral_factor
        + 8    // liquidation_threshold
        + 8    // liquidation_bonus
        + 8    // withdrawal_limit_bps
        + 8    // rate_limit_slot
        + 8    // withdrawn_this_slot
        + 8    // borrow_rate_bps       ← NEW Phase 1
        + 8    // treasury_accumulated  ← NEW Phase 1
        + 1    // is_paused
        + 1;   // bump

    pub fn available_liquidity(&self) -> u64 {
        self.total_deposits.saturating_sub(self.total_borrows)
    }

    pub fn utilization_rate(&self) -> u64 {
        if self.total_deposits == 0 { return 0; }
        self.total_borrows
            .checked_mul(10_000).unwrap_or(0)
            .checked_div(self.total_deposits).unwrap_or(0)
    }

    pub fn max_withdrawal_this_slot(&self) -> u64 {
        self.total_deposits
            .checked_mul(self.withdrawal_limit_bps).unwrap_or(0)
            .checked_div(10_000).unwrap_or(0)
    }

    pub fn remaining_withdrawal_capacity(&self, current_slot: u64) -> u64 {
        if current_slot > self.rate_limit_slot {
            return self.max_withdrawal_this_slot();
        }
        self.max_withdrawal_this_slot()
            .saturating_sub(self.withdrawn_this_slot)
    }

    /// Kinked interest rate model — same design as Compound/Aave
    ///
    /// Below optimal utilization (80%): 0.5% → 4% APY (gentle slope)
    /// Above optimal utilization (80%): 4% → 150% APY (steep slope)
    ///
    /// High rates above optimal discourage over-borrowing and
    /// incentivize depositors to supply liquidity when it's needed most.
    pub fn calculate_borrow_rate_bps(utilization_bps: u64) -> u64 {
        const OPTIMAL_UTILIZATION: u64 = 8_000; // 80%
        const BASE_RATE: u64 = 50;              // 0.5% APY minimum
        const OPTIMAL_RATE: u64 = 400;          // 4% APY at optimal
        const MAX_RATE: u64 = 15_000;           // 150% APY at 100%

        if utilization_bps == 0 {
            return BASE_RATE;
        }

        if utilization_bps <= OPTIMAL_UTILIZATION {
            // Linear slope: BASE_RATE to OPTIMAL_RATE
            let slope = (OPTIMAL_RATE - BASE_RATE)
                .checked_mul(utilization_bps).unwrap_or(0)
                .checked_div(OPTIMAL_UTILIZATION).unwrap_or(0);
            BASE_RATE + slope
        } else {
            // Steep slope: OPTIMAL_RATE to MAX_RATE
            let excess = utilization_bps - OPTIMAL_UTILIZATION;
            let steep_slope = (MAX_RATE - OPTIMAL_RATE)
                .checked_mul(excess).unwrap_or(0)
                .checked_div(10_000 - OPTIMAL_UTILIZATION).unwrap_or(0);
            OPTIMAL_RATE + steep_slope
        }
    }

    /// Update borrow rate based on current utilization
    /// Call this at the start of every deposit/borrow/repay/withdraw
    pub fn update_borrow_rate(&mut self) {
        let util = self.utilization_rate();
        self.borrow_rate_bps = Self::calculate_borrow_rate_bps(util);
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolConfig {
    pub reserve_factor: u64,
    pub collateral_factor: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,
    pub oracle: Pubkey,
    pub withdrawal_limit_bps: u64,
}

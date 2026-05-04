use anchor_lang::prelude::*;

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

    // ── Rate Limit Fields (NEW) ──────────────────────────────────────
    /// Max % of pool liquidity withdrawable per slot (basis points)
    /// e.g. 1000 = 10% per slot max
    pub withdrawal_limit_bps: u64,

    /// Slot when the current rate limit window started
    pub rate_limit_slot: u64,

    /// Total withdrawn in the current slot window
    pub withdrawn_this_slot: u64,

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
        + 8    // withdrawal_limit_bps  ← NEW
        + 8    // rate_limit_slot       ← NEW
        + 8    // withdrawn_this_slot   ← NEW
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

    /// Max withdrawable in current slot window
    /// = withdrawal_limit_bps% of total deposits
    pub fn max_withdrawal_this_slot(&self) -> u64 {
        self.total_deposits
            .checked_mul(self.withdrawal_limit_bps).unwrap_or(0)
            .checked_div(10_000).unwrap_or(0)
    }

    /// How much is still available to withdraw in this slot
    /// Resets every new slot
    pub fn remaining_withdrawal_capacity(&self, current_slot: u64) -> u64 {
        // New slot — full capacity available
        if current_slot > self.rate_limit_slot {
            return self.max_withdrawal_this_slot();
        }
        // Same slot — subtract what's already been withdrawn
        self.max_withdrawal_this_slot()
            .saturating_sub(self.withdrawn_this_slot)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolConfig {
    pub reserve_factor: u64,
    pub collateral_factor: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,
    pub oracle: Pubkey,
    /// Max withdrawal per slot in basis points (e.g. 1000 = 10%)
    pub withdrawal_limit_bps: u64,
}

use anchor_lang::prelude::*;

#[account]
pub struct LendingPool {
    /// Current protocol authority (admin)
    pub authority: Pubkey,
    /// Nominated next authority — must accept to take effect
    pub pending_authority: Pubkey,
    /// SPL token this pool accepts
    pub token_mint: Pubkey,
    /// Vault holding deposited tokens
    pub token_vault: Pubkey,
    /// Pyth price feed for this token
    pub oracle: Pubkey,
    /// Total tokens deposited
    pub total_deposits: u64,
    /// Total tokens currently borrowed
    pub total_borrows: u64,
    /// Protocol reserve cut (basis points)
    pub reserve_factor: u64,
    /// Max LTV ratio (basis points)
    pub collateral_factor: u64,
    /// Threshold below which liquidation is allowed (basis points)
    pub liquidation_threshold: u64,
    /// Bonus rewarded to liquidators (basis points)
    pub liquidation_bonus: u64,
    /// Emergency pause flag
    pub is_paused: bool,
    /// PDA bump
    pub bump: u8,
}

impl LendingPool {
    pub const LEN: usize = 8   // discriminator
        + 32   // authority
        + 32   // pending_authority  ← NEW
        + 32   // token_mint
        + 32   // token_vault
        + 32   // oracle
        + 8    // total_deposits
        + 8    // total_borrows
        + 8    // reserve_factor
        + 8    // collateral_factor
        + 8    // liquidation_threshold
        + 8    // liquidation_bonus
        + 1    // is_paused
        + 1;   // bump

    pub fn available_liquidity(&self) -> u64 {
        self.total_deposits.saturating_sub(self.total_borrows)
    }

    pub fn utilization_rate(&self) -> u64 {
        if self.total_deposits == 0 {
            return 0;
        }
        self.total_borrows
            .checked_mul(10_000)
            .unwrap_or(0)
            .checked_div(self.total_deposits)
            .unwrap_or(0)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolConfig {
    pub reserve_factor: u64,
    pub collateral_factor: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,
    pub oracle: Pubkey,
}

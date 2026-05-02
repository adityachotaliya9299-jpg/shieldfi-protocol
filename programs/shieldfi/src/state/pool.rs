use anchor_lang::prelude::*;

/// Core lending pool — one pool per supported token
#[account]
pub struct LendingPool {
    /// Protocol authority (admin)
    pub authority: Pubkey,
    /// SPL token this pool accepts (e.g. USDC)
    pub token_mint: Pubkey,
    /// Vault that holds the deposited tokens
    pub token_vault: Pubkey,
    /// Total tokens deposited into pool
    pub total_deposits: u64,
    /// Total tokens currently borrowed
    pub total_borrows: u64,
    /// % of interest kept as protocol reserve (basis points, e.g. 1000 = 10%)
    pub reserve_factor: u64,
    /// Max loan-to-value ratio (basis points, e.g. 7500 = 75%)
    pub collateral_factor: u64,
    /// Health factor threshold to trigger liquidation (basis points)
    pub liquidation_threshold: u64,
    /// Bonus paid to liquidators (basis points, e.g. 500 = 5%)
    pub liquidation_bonus: u64,
    /// Emergency pause — blocks all deposits/borrows when true
    pub is_paused: bool,
    /// PDA bump
    pub bump: u8,
}

impl LendingPool {
    pub const LEN: usize = 8   // discriminator
        + 32   // authority
        + 32   // token_mint
        + 32   // token_vault
        + 8    // total_deposits
        + 8    // total_borrows
        + 8    // reserve_factor
        + 8    // collateral_factor
        + 8    // liquidation_threshold
        + 8    // liquidation_bonus
        + 1    // is_paused
        + 1;   // bump

    /// Available liquidity = deposits - borrows
    pub fn available_liquidity(&self) -> u64 {
        self.total_deposits.saturating_sub(self.total_borrows)
    }

    /// Utilization rate in basis points (borrows / deposits * 10000)
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

/// Config passed when creating a new pool
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolConfig {
    pub reserve_factor: u64,
    pub collateral_factor: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,
}

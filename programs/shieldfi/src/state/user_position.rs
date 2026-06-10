use anchor_lang::prelude::*;

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub deposited_amount: u64,
    pub borrowed_amount: u64,
    pub last_update_slot: u64,
    pub accrued_interest: u64,
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;

    /// Health factor using CEILING DIVISION — fixes M-01
    /// Prevents boundary rounding making safe positions liquidatable
    pub fn health_factor(&self, collateral_factor: u64) -> u64 {
        let total_debt = self.borrowed_amount
            .checked_add(self.accrued_interest)
            .unwrap_or(u64::MAX);

        if total_debt == 0 { return u64::MAX; }

        let numerator = self.deposited_amount
            .checked_mul(collateral_factor)
            .unwrap_or(0);

        if numerator == 0 { return 0; }

        // Ceiling division: (a + b - 1) / b
        numerator
            .checked_add(total_debt.saturating_sub(1))
            .unwrap_or(numerator)
            .checked_div(total_debt)
            .unwrap_or(0)
    }

    pub fn is_liquidatable(&self, collateral_factor: u64) -> bool {
        self.health_factor(collateral_factor) < 10_000
    }
}

use anchor_lang::prelude::*;
use crate::state::SLOTS_PER_YEAR;

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

    /// Accrue interest since last update slot
    /// Called at the start of every borrow/repay/withdraw/liquidate
    ///
    /// interest = principal * annual_rate * (slots_elapsed / slots_per_year)
    /// Using integer math to avoid floating point
    pub fn accrue_interest(&mut self, borrow_rate_bps: u64, current_slot: u64) {
        if self.borrowed_amount == 0 {
            self.last_update_slot = current_slot;
            return;
        }

        let slots_elapsed = current_slot.saturating_sub(self.last_update_slot);
        if slots_elapsed == 0 { return; }

        // interest = borrowed * rate_bps * slots_elapsed / 10_000 / slots_per_year
        // Split multiplication to avoid u64 overflow
        let interest = (self.borrowed_amount as u128)
            .checked_mul(borrow_rate_bps as u128).unwrap_or(0)
            .checked_mul(slots_elapsed as u128).unwrap_or(0)
            .checked_div(10_000).unwrap_or(0)
            .checked_div(SLOTS_PER_YEAR as u128).unwrap_or(0) as u64;

        self.accrued_interest = self.accrued_interest.saturating_add(interest);
        self.last_update_slot = current_slot;
    }

    /// Health factor using CEILING DIVISION — fixes M-01
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

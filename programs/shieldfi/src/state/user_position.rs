use anchor_lang::prelude::*;

/// Tracks each user's position in a specific lending pool
#[account]
pub struct UserPosition {
    /// User wallet pubkey
    pub owner: Pubkey,
    /// The pool this position belongs to
    pub pool: Pubkey,
    /// Total collateral deposited (in token native units)
    pub deposited_amount: u64,
    /// Total amount currently borrowed
    pub borrowed_amount: u64,
    /// Slot when interest was last accrued
    pub last_update_slot: u64,
    /// Cumulative interest owed (scaled by 1e9)
    pub accrued_interest: u64,
    /// PDA bump
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8   // discriminator
        + 32   // owner
        + 32   // pool
        + 8    // deposited_amount
        + 8    // borrowed_amount
        + 8    // last_update_slot
        + 8    // accrued_interest
        + 1;   // bump

    /// Health factor in basis points
    /// health = (deposited * collateral_factor) / (borrowed + interest)
    /// A position is liquidatable when health < 10_000 (i.e. < 1.0)
    pub fn health_factor(&self, collateral_factor: u64) -> u64 {
        let total_debt = self
            .borrowed_amount
            .checked_add(self.accrued_interest)
            .unwrap_or(u64::MAX);

        if total_debt == 0 {
            return u64::MAX; // No debt = perfectly healthy
        }

        self.deposited_amount
            .checked_mul(collateral_factor)
            .unwrap_or(0)
            .checked_div(total_debt)
            .unwrap_or(0)
    }

    /// Returns true if position can be liquidated
    pub fn is_liquidatable(&self, collateral_factor: u64) -> bool {
        self.health_factor(collateral_factor) < 10_000
    }
}

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::PoolConfig;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod shieldfi {
    use super::*;

    /// Initialize a new lending pool for a given SPL token
    pub fn initialize_pool(ctx: Context<InitializePool>, config: PoolConfig) -> Result<()> {
        instructions::initialize_pool(ctx, config)
    }

    /// Deposit tokens as collateral into the pool
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    /// Withdraw previously deposited collateral
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }

    /// Borrow tokens against deposited collateral
    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        instructions::borrow(ctx, amount)
    }

    /// Repay borrowed tokens (interest first, then principal)
    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay(ctx, amount)
    }

    // Phase 3 — Liquidation + Oracle:
    // pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()>

    // Phase 4 — Admin / Security:
    // pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()>
    // pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()>
}

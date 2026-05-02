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

    // Phase 2 instructions — coming next:
    // pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()>
    // pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()>
    // pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()>
    // pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()>

    // Phase 3 — Liquidation:
    // pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()>

    // Phase 4 — Admin / Security:
    // pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()>
    // pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()>
}

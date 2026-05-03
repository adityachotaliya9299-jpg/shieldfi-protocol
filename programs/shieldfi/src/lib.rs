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

    // ─── Pool Lifecycle ───────────────────────────────────────────
    pub fn initialize_pool(ctx: Context<InitializePool>, config: PoolConfig) -> Result<()> {
        instructions::initialize_pool(ctx, config)
    }

    // ─── Core Lending ─────────────────────────────────────────────
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }

    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        instructions::borrow(ctx, amount)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay(ctx, amount)
    }

    // ─── Liquidation ──────────────────────────────────────────────
    pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
        instructions::liquidate(ctx, repay_amount)
    }

    // ─── Security / Admin ─────────────────────────────────────────

    /// Emergency circuit breaker — halts all user operations
    pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::pause_protocol(ctx)
    }

    /// Resume pool after incident is resolved
    pub fn resume_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::resume_protocol(ctx)
    }

    /// Update risk parameters (collateral factor, thresholds, oracle)
    pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()> {
        instructions::update_pool_config(ctx, config)
    }

    /// Step 1: Nominate a new authority (two-step handover)
    pub fn nominate_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::nominate_authority(ctx, new_authority)
    }

    /// Step 2: New authority accepts control
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority(ctx)
    }
}

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::PoolConfig;

declare_id!("3BA8RfgSqUrDynoUPFW2YLNzw9KHH1ErRTTTWNbdBoHM");

// ── Phase 1: On-Chain Events ─────────────────────────────────────────
#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub total_pool_deposits: u64,
    pub borrow_rate_bps: u64,
    pub slot: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub remaining_deposited: u64,
    pub slot: u64,
}

#[event]
pub struct BorrowEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub total_debt: u64,
    pub health_factor: u64,
    pub borrow_rate_bps: u64,
    pub slot: u64,
}

#[event]
pub struct RepayEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub interest_paid: u64,
    pub protocol_fee: u64,
    pub remaining_debt: u64,
    pub slot: u64,
}

#[event]
pub struct LiquidationEvent {
    pub liquidator: Pubkey,
    pub borrower: Pubkey,
    pub repaid: u64,
    pub collateral_seized: u64,
    pub health_before: u64,
    pub slot: u64,
}

#[event]
pub struct CircuitBreakerEvent {
    pub fired_by: Pubkey,
    pub is_paused: bool,
    pub total_deposits: u64,
    pub slot: u64,
}

#[event]
pub struct RateLimitHitEvent {
    pub user: Pubkey,
    pub attempted: u64,
    pub slot_capacity: u64,
    pub slot: u64,
}

#[event]
pub struct InterestAccruedEvent {
    pub user: Pubkey,
    pub interest_added: u64,
    pub total_accrued: u64,
    pub borrow_rate_bps: u64,
    pub slot: u64,
}
// ─────────────────────────────────────────────────────────────────────

#[program]
pub mod shieldfi {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, config: PoolConfig) -> Result<()> {
        instructions::initialize_pool(ctx, config)
    }
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
    pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
        instructions::liquidate(ctx, repay_amount)
    }
    pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::pause_protocol(ctx)
    }
    pub fn resume_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::resume_protocol(ctx)
    }
    pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()> {
        instructions::update_pool_config(ctx, config)
    }
    pub fn nominate_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::nominate_authority(ctx, new_authority)
    }
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority(ctx)
    }
}

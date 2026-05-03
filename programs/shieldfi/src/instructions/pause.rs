use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::ShieldFiError;
use crate::state::LendingPool;

/// Admin can pause ALL operations on a pool instantly
/// This is the circuit breaker — used during exploits or oracle failure
pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        ShieldFiError::Unauthorized
    );

    let pool = &mut ctx.accounts.pool;
    pool.is_paused = true;

    msg!(
        "⚠️  ShieldFi pool PAUSED by authority: {}",
        ctx.accounts.authority.key()
    );

    Ok(())
}

/// Admin can resume operations after an incident is resolved
pub fn resume_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        ShieldFiError::Unauthorized
    );

    let pool = &mut ctx.accounts.pool;
    pool.is_paused = false;

    msg!(
        "✅  ShieldFi pool RESUMED by authority: {}",
        ctx.accounts.authority.key()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct PauseProtocol<'info> {
    /// Must be the pool's registered authority
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, LendingPool>,
}

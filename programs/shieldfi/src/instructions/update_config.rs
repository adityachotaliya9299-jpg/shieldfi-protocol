use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, PoolConfig};

/// Authority can update pool risk parameters
/// Guarded: only authority can call, values validated before applying
pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        ShieldFiError::Unauthorized
    );

    // Validate new config values are sane
    require!(
        config.collateral_factor < config.liquidation_threshold,
        ShieldFiError::InvalidPoolConfig
    );
    require!(
        config.liquidation_threshold <= 10_000,
        ShieldFiError::InvalidPoolConfig
    );
    require!(
        config.reserve_factor <= 5_000, // Max 50% reserve
        ShieldFiError::InvalidPoolConfig
    );
    require!(
        config.liquidation_bonus <= 2_000, // Max 20% bonus
        ShieldFiError::InvalidPoolConfig
    );

    let pool = &mut ctx.accounts.pool;

    // Log old values before updating (useful for on-chain audit trail)
    msg!(
        "Config update by {}. Old: cf={} lt={} rf={} lb={} oracle={}",
        ctx.accounts.authority.key(),
        pool.collateral_factor,
        pool.liquidation_threshold,
        pool.reserve_factor,
        pool.liquidation_bonus,
        pool.oracle,
    );

    pool.collateral_factor     = config.collateral_factor;
    pool.liquidation_threshold = config.liquidation_threshold;
    pool.reserve_factor        = config.reserve_factor;
    pool.liquidation_bonus     = config.liquidation_bonus;
    pool.oracle                = config.oracle;

    msg!(
        "Config update applied. New: cf={} lt={} rf={} lb={} oracle={}",
        pool.collateral_factor,
        pool.liquidation_threshold,
        pool.reserve_factor,
        pool.liquidation_bonus,
        pool.oracle,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
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

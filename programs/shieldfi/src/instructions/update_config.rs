use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, PoolConfig};

pub fn update_pool_config(ctx: Context<UpdateConfig>, config: PoolConfig) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        ShieldFiError::Unauthorized
    );
    require!(
        config.collateral_factor < config.liquidation_threshold,
        ShieldFiError::InvalidPoolConfig
    );
    require!(config.liquidation_threshold <= 10_000, ShieldFiError::InvalidPoolConfig);
    require!(config.reserve_factor <= 5_000, ShieldFiError::InvalidPoolConfig);
    require!(config.liquidation_bonus <= 2_000, ShieldFiError::InvalidPoolConfig);
    require!(
        config.withdrawal_limit_bps >= 100 && config.withdrawal_limit_bps <= 5_000,
        ShieldFiError::InvalidPoolConfig
    );

    let pool = &mut ctx.accounts.pool;

    msg!(
        "Config update: cf={} lt={} rf={} lb={} rate_limit={}bps",
        config.collateral_factor,
        config.liquidation_threshold,
        config.reserve_factor,
        config.liquidation_bonus,
        config.withdrawal_limit_bps,
    );

    pool.collateral_factor     = config.collateral_factor;
    pool.liquidation_threshold = config.liquidation_threshold;
    pool.reserve_factor        = config.reserve_factor;
    pool.liquidation_bonus     = config.liquidation_bonus;
    pool.oracle                = config.oracle;
    pool.withdrawal_limit_bps  = config.withdrawal_limit_bps;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
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

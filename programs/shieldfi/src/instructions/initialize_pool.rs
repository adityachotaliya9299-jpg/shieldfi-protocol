use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, PoolConfig};

pub fn initialize_pool(ctx: Context<InitializePool>, config: PoolConfig) -> Result<()> {
    require!(
        config.collateral_factor < config.liquidation_threshold,
        ShieldFiError::InvalidPoolConfig
    );
    require!(config.liquidation_threshold <= 10_000, ShieldFiError::InvalidPoolConfig);
    require!(config.reserve_factor <= 5_000, ShieldFiError::InvalidPoolConfig);
    require!(config.liquidation_bonus <= 2_000, ShieldFiError::InvalidPoolConfig);
    // Rate limit must be between 1% and 50% per slot
    require!(
        config.withdrawal_limit_bps >= 100 && config.withdrawal_limit_bps <= 5_000,
        ShieldFiError::InvalidPoolConfig
    );

    let pool = &mut ctx.accounts.pool;
    let bump = ctx.bumps.pool;

    pool.authority             = ctx.accounts.authority.key();
    pool.pending_authority     = Pubkey::default();
    pool.token_mint            = ctx.accounts.token_mint.key();
    pool.token_vault           = ctx.accounts.token_vault.key();
    pool.oracle                = config.oracle;
    pool.total_deposits        = 0;
    pool.total_borrows         = 0;
    pool.reserve_factor        = config.reserve_factor;
    pool.collateral_factor     = config.collateral_factor;
    pool.liquidation_threshold = config.liquidation_threshold;
    pool.liquidation_bonus     = config.liquidation_bonus;
    pool.withdrawal_limit_bps  = config.withdrawal_limit_bps;
    pool.rate_limit_slot       = 0;
    pool.withdrawn_this_slot   = 0;
    pool.is_paused             = false;
    pool.bump                  = bump;

    msg!(
        "ShieldFi pool initialized. Mint: {} | Rate limit: {}bps/slot",
        ctx.accounts.token_mint.key(),
        config.withdrawal_limit_bps,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = LendingPool::LEN,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LendingPool>,

    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = pool,
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

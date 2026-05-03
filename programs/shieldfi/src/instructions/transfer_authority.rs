use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::ShieldFiError;
use crate::state::LendingPool;

/// Two-step authority transfer for maximum security
/// Step 1: Current authority nominates a pending authority
/// Step 2: Pending authority must accept (prevents accidental lockout)

pub fn nominate_authority(
    ctx: Context<TransferAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        ShieldFiError::Unauthorized
    );

    // Store pending authority in pool (we add this field below)
    let pool = &mut ctx.accounts.pool;
    pool.pending_authority = new_authority;

    msg!(
        "Authority nomination: {} → {}",
        ctx.accounts.authority.key(),
        new_authority
    );

    Ok(())
}

pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    require!(
        ctx.accounts.new_authority.key() == pool.pending_authority,
        ShieldFiError::Unauthorized
    );

    let old = pool.authority;
    pool.authority = ctx.accounts.new_authority.key();
    pool.pending_authority = Pubkey::default();

    msg!(
        "Authority transferred: {} → {}",
        old,
        pool.authority
    );

    Ok(())
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump = pool.bump,
        constraint = pool.authority == authority.key() @ ShieldFiError::Unauthorized
    )]
    pub pool: Account<'info, LendingPool>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(mut)]
    pub new_authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump = pool.bump,
        constraint = pool.pending_authority == new_authority.key() @ ShieldFiError::Unauthorized
    )]
    pub pool: Account<'info, LendingPool>,
}

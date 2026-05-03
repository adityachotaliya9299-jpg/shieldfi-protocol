use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};

pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let position = &ctx.accounts.user_position;
    let pool = &ctx.accounts.pool;

    // Max borrowable = deposited * collateral_factor / 10_000
    let max_borrow = position
        .deposited_amount
        .checked_mul(pool.collateral_factor)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ShieldFiError::MathOverflow)?;

    let new_total_borrow = position
        .borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(
        new_total_borrow <= max_borrow,
        ShieldFiError::InsufficientCollateral
    );

    // Pool must have enough liquidity
    require!(
        pool.available_liquidity() >= amount,
        ShieldFiError::InsufficientLiquidity
    );

    // Sign with pool PDA
    let token_mint_key = ctx.accounts.token_mint.key();
    let seeds = &[
        b"pool",
        token_mint_key.as_ref(),
        &[pool.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.token_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    // Update state
    let pool = &mut ctx.accounts.pool;
    pool.total_borrows = pool
        .total_borrows
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    let position = &mut ctx.accounts.user_position;
    position.borrowed_amount = position
        .borrowed_amount
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;
    position.last_update_slot = Clock::get()?.slot;

    msg!(
        "Borrow: {} tokens by {}. Total borrowed: {}",
        amount,
        ctx.accounts.user.key(),
        position.borrowed_amount
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, LendingPool>,

    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key()
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = user_token_account.mint == token_mint.key(),
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};

pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let position = &ctx.accounts.user_position;

    let total_debt = position
        .borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(total_debt > 0, ShieldFiError::RepayExceedsDebt);
    require!(amount <= total_debt, ShieldFiError::RepayExceedsDebt);

    // Transfer tokens from user → vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.token_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Repay interest first, then principal
    let position = &mut ctx.accounts.user_position;
    let mut remaining = amount;

    if remaining >= position.accrued_interest {
        remaining -= position.accrued_interest;
        position.accrued_interest = 0;
    } else {
        position.accrued_interest -= remaining;
        remaining = 0;
    }

    position.borrowed_amount = position
        .borrowed_amount
        .checked_sub(remaining)
        .ok_or(ShieldFiError::MathOverflow)?;

    position.last_update_slot = Clock::get()?.slot;

    // Update pool
    let pool = &mut ctx.accounts.pool;
    pool.total_borrows = pool
        .total_borrows
        .saturating_sub(remaining);

    msg!(
        "Repay: {} tokens by {}. Remaining debt: {}",
        amount,
        ctx.accounts.user.key(),
        position.borrowed_amount
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Repay<'info> {
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

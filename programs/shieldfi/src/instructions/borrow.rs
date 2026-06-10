use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};
use crate::{BorrowEvent, InterestAccruedEvent};

pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let current_slot = Clock::get()?.slot;

    // ── Phase 1: Accrue interest first ───────────────────────────────
    let borrow_rate = ctx.accounts.pool.borrow_rate_bps;
    let interest_before = ctx.accounts.user_position.accrued_interest;
    ctx.accounts.user_position.accrue_interest(borrow_rate, current_slot);
    let interest_added = ctx.accounts.user_position.accrued_interest
        .saturating_sub(interest_before);
    if interest_added > 0 {
        emit!(InterestAccruedEvent {
            user: ctx.accounts.user.key(),
            interest_added,
            total_accrued: ctx.accounts.user_position.accrued_interest,
            borrow_rate_bps: borrow_rate,
            slot: current_slot,
        });
    }
    // ─────────────────────────────────────────────────────────────────

    let pool = &ctx.accounts.pool;
    let position = &ctx.accounts.user_position;

    // Rate limit check
    let capacity = pool.remaining_withdrawal_capacity(current_slot);
    require!(amount <= capacity, ShieldFiError::BorrowRateLimitExceeded);

    // Collateral factor check (includes accrued interest in debt)
    let max_borrow = position.deposited_amount
        .checked_mul(pool.collateral_factor)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ShieldFiError::MathOverflow)?;

    let new_total_borrow = position.borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(new_total_borrow <= max_borrow, ShieldFiError::InsufficientCollateral);
    require!(pool.available_liquidity() >= amount, ShieldFiError::InsufficientLiquidity);

    // PDA-signed vault → user transfer
    let token_mint_key = ctx.accounts.token_mint.key();
    let seeds = &[b"pool", token_mint_key.as_ref(), &[pool.bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.token_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds),
        amount,
    )?;

    // Update rate limit state
    let pool = &mut ctx.accounts.pool;
    if current_slot > pool.rate_limit_slot {
        pool.rate_limit_slot = current_slot;
        pool.withdrawn_this_slot = amount;
    } else {
        pool.withdrawn_this_slot = pool.withdrawn_this_slot
            .checked_add(amount)
            .ok_or(ShieldFiError::MathOverflow)?;
    }

    pool.total_borrows = pool.total_borrows
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    // ── Phase 1: Update borrow rate ───────────────────────────────────
    pool.update_borrow_rate();
    // ─────────────────────────────────────────────────────────────────

    let position = &mut ctx.accounts.user_position;
    position.borrowed_amount = position.borrowed_amount
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;
    position.last_update_slot = current_slot;

    let health = position.health_factor(ctx.accounts.pool.collateral_factor);
    let total_debt = position.borrowed_amount
        .checked_add(position.accrued_interest)
        .unwrap_or(0);

    // ── Phase 1: Emit borrow event ────────────────────────────────────
    emit!(BorrowEvent {
        user: ctx.accounts.user.key(),
        amount,
        total_debt,
        health_factor: health,
        borrow_rate_bps: ctx.accounts.pool.borrow_rate_bps,
        slot: current_slot,
    });
    // ─────────────────────────────────────────────────────────────────

    msg!("Borrow: {} | Rate limit: {}/{} | Health: {} | Rate: {}bps",
        amount,
        ctx.accounts.pool.withdrawn_this_slot,
        ctx.accounts.pool.max_withdrawal_this_slot(),
        health,
        ctx.accounts.pool.borrow_rate_bps);

    Ok(())
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"pool", token_mint.key().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, LendingPool>,
    #[account(mut, seeds = [b"position", pool.key().as_ref(), user.key().as_ref()], bump = user_position.bump, constraint = user_position.owner == user.key())]
    pub user_position: Account<'info, UserPosition>,
    #[account(mut, constraint = user_token_account.mint == token_mint.key(), constraint = user_token_account.owner == user.key())]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", token_mint.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

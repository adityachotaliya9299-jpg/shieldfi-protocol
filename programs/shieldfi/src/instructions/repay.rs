use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};
use crate::{RepayEvent, InterestAccruedEvent};

pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let current_slot = Clock::get()?.slot;

    // ── Phase 1: Accrue interest before repayment ─────────────────────
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

    let position = &ctx.accounts.user_position;
    let total_debt = position.borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(total_debt > 0, ShieldFiError::RepayExceedsDebt);
    require!(amount <= total_debt, ShieldFiError::RepayExceedsDebt);

    // Transfer tokens user → vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.token_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        amount,
    )?;

    // Repay interest first, then principal
    let position = &mut ctx.accounts.user_position;
    let mut remaining = amount;
    let interest_paid;

    if remaining >= position.accrued_interest {
        interest_paid = position.accrued_interest;
        remaining -= position.accrued_interest;
        position.accrued_interest = 0;
    } else {
        interest_paid = remaining;
        position.accrued_interest -= remaining;
        remaining = 0;
    }

    let principal_repaid = remaining;
    position.borrowed_amount = position.borrowed_amount
        .checked_sub(principal_repaid)
        .ok_or(ShieldFiError::MathOverflow)?;
    position.last_update_slot = current_slot;

    // ── Phase 1: Collect treasury fee from interest paid ─────────────
    // reserve_factor% of interest paid goes to protocol treasury
    let protocol_fee = (interest_paid as u128)
        .checked_mul(ctx.accounts.pool.reserve_factor as u128).unwrap_or(0)
        .checked_div(10_000).unwrap_or(0) as u64;

    let pool = &mut ctx.accounts.pool;
    pool.treasury_accumulated = pool.treasury_accumulated
        .saturating_add(protocol_fee);
    // ─────────────────────────────────────────────────────────────────

    pool.total_borrows = pool.total_borrows.saturating_sub(principal_repaid);

    // ── Phase 1: Update borrow rate after repay ───────────────────────
    pool.update_borrow_rate();
    // ─────────────────────────────────────────────────────────────────

    let remaining_debt = position.borrowed_amount
        .checked_add(position.accrued_interest)
        .unwrap_or(0);

    // ── Phase 1: Emit repay event ─────────────────────────────────────
    emit!(RepayEvent {
        user: ctx.accounts.user.key(),
        amount,
        interest_paid,
        protocol_fee,
        remaining_debt,
        slot: current_slot,
    });
    // ─────────────────────────────────────────────────────────────────

    msg!("Repay: {} | Interest paid: {} | Protocol fee: {} | Remaining debt: {} | Treasury: {}",
        amount, interest_paid, protocol_fee, remaining_debt, pool.treasury_accumulated);

    Ok(())
}

#[derive(Accounts)]
pub struct Repay<'info> {
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

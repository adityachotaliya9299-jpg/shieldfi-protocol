use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};
use crate::{DepositEvent, InterestAccruedEvent};

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let current_slot = Clock::get()?.slot;

    // ── Phase 1: Accrue interest before any state change ─────────────
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

    // Update pool + position
    let pool = &mut ctx.accounts.pool;
    pool.total_deposits = pool.total_deposits
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    // ── Phase 1: Update borrow rate after deposit changes utilization ─
    pool.update_borrow_rate();
    // ─────────────────────────────────────────────────────────────────

    let position = &mut ctx.accounts.user_position;
    position.owner = ctx.accounts.user.key();
    position.pool = pool.key();
    position.deposited_amount = position.deposited_amount
        .checked_add(amount)
        .ok_or(ShieldFiError::MathOverflow)?;
    position.last_update_slot = current_slot;
    position.bump = ctx.bumps.user_position;

    // ── Phase 1: Emit deposit event ───────────────────────────────────
    emit!(DepositEvent {
        user: ctx.accounts.user.key(),
        amount,
        total_pool_deposits: pool.total_deposits,
        borrow_rate_bps: pool.borrow_rate_bps,
        slot: current_slot,
    });
    // ─────────────────────────────────────────────────────────────────

    msg!("Deposit: {} | Total deposits: {} | Borrow rate: {}bps APY",
        amount, pool.total_deposits, pool.borrow_rate_bps);

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"pool", token_mint.key().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, LendingPool>,
    #[account(
        init_if_needed, payer = user, space = UserPosition::LEN,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()], bump
    )]
    pub user_position: Account<'info, UserPosition>,
    #[account(mut, constraint = user_token_account.mint == token_mint.key(), constraint = user_token_account.owner == user.key())]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", token_mint.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{LendingPool, UserPosition};

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    let current_slot = Clock::get()?.slot;
    let pool = &ctx.accounts.pool;
    let position = &ctx.accounts.user_position;

    // ── Rate Limit Check ──────────────────────────────────────────────
    // Prevents draining pool in one block during an exploit
    let capacity = pool.remaining_withdrawal_capacity(current_slot);
    require!(
        amount <= capacity,
        ShieldFiError::WithdrawalRateLimitExceeded
    );
    // ─────────────────────────────────────────────────────────────────

    // Health factor check after withdrawal
    require!(
        position.deposited_amount >= amount,
        ShieldFiError::WithdrawExceedsDeposit
    );

    let total_debt = position
        .borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?;

    if total_debt > 0 {
        let new_deposited = position
            .deposited_amount
            .checked_sub(amount)
            .ok_or(ShieldFiError::MathOverflow)?;

        let health_after = new_deposited
            .checked_mul(pool.collateral_factor)
            .ok_or(ShieldFiError::MathOverflow)?
            .checked_div(total_debt)
            .ok_or(ShieldFiError::MathOverflow)?;

        require!(health_after >= 10_000, ShieldFiError::InsufficientCollateral);
    }

    // Pool liquidity check
    require!(
        pool.available_liquidity() >= amount,
        ShieldFiError::InsufficientLiquidity
    );

    // Sign with pool PDA for vault transfer
    let token_mint_key = ctx.accounts.token_mint.key();
    let seeds = &[b"pool", token_mint_key.as_ref(), &[pool.bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.token_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        ),
        amount,
    )?;

    // Update rate limit state
    let pool = &mut ctx.accounts.pool;
    if current_slot > pool.rate_limit_slot {
        // New slot — reset the counter
        pool.rate_limit_slot = current_slot;
        pool.withdrawn_this_slot = amount;
    } else {
        // Same slot — accumulate
        pool.withdrawn_this_slot = pool
            .withdrawn_this_slot
            .checked_add(amount)
            .ok_or(ShieldFiError::MathOverflow)?;
    }

    // Update pool and position state
    pool.total_deposits = pool
        .total_deposits
        .checked_sub(amount)
        .ok_or(ShieldFiError::MathOverflow)?;

    let position = &mut ctx.accounts.user_position;
    position.deposited_amount = position
        .deposited_amount
        .checked_sub(amount)
        .ok_or(ShieldFiError::MathOverflow)?;
    position.last_update_slot = current_slot;

    msg!(
        "Withdraw: {} tokens. Rate limit: {}/{} used this slot.",
        amount,
        ctx.accounts.pool.withdrawn_this_slot,
        ctx.accounts.pool.max_withdrawal_this_slot()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ShieldFiError;
use crate::state::{get_validated_price, LendingPool, UserPosition, PRICE_PRECISION};

pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
    require!(repay_amount > 0, ShieldFiError::ZeroAmount);
    require!(!ctx.accounts.pool.is_paused, ShieldFiError::ProtocolPaused);

    // Oracle must match what the pool registered
    require!(
        ctx.accounts.oracle.key() == ctx.accounts.pool.oracle,
        ShieldFiError::OracleMismatch
    );

    // Use unix_timestamp for pyth 0.8.0 staleness check
    let current_time = Clock::get()?.unix_timestamp;

    // Fetch real-time validated price from Pyth
    let token_price_usd = get_validated_price(&ctx.accounts.oracle, current_time)?;

    let position = &ctx.accounts.borrower_position;
    let pool = &ctx.accounts.pool;

    // Collateral value in USD (6 decimal precision)
    let collateral_value_usd = position
        .deposited_amount
        .checked_mul(token_price_usd)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(PRICE_PRECISION)
        .ok_or(ShieldFiError::MathOverflow)?;

    // Total debt value in USD
    let total_debt = position
        .borrowed_amount
        .checked_add(position.accrued_interest)
        .ok_or(ShieldFiError::MathOverflow)?;

    let debt_value_usd = total_debt
        .checked_mul(token_price_usd)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(PRICE_PRECISION)
        .ok_or(ShieldFiError::MathOverflow)?;

    // Health = (collateral_usd * liq_threshold) / debt_usd
    // Liquidatable when health < 10_000
    let health = collateral_value_usd
        .checked_mul(pool.liquidation_threshold)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(debt_value_usd.max(1))
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(health < 10_000, ShieldFiError::PositionHealthy);

    // Max liquidatable = 50% of outstanding debt (partial liquidation only)
    let max_repay = total_debt.checked_div(2).ok_or(ShieldFiError::MathOverflow)?;
    require!(repay_amount <= max_repay, ShieldFiError::LiquidationTooLarge);

    // Collateral seized = repay * (1 + liquidation_bonus)
    let bonus_multiplier = pool
        .liquidation_bonus
        .checked_add(10_000)
        .ok_or(ShieldFiError::MathOverflow)?;

    let collateral_to_seize = repay_amount
        .checked_mul(bonus_multiplier)
        .ok_or(ShieldFiError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(
        collateral_to_seize <= position.deposited_amount,
        ShieldFiError::InsufficientCollateral
    );

    // Step 1: Liquidator repays borrower's debt → vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.liquidator_token_account.to_account_info(),
        to: ctx.accounts.token_vault.to_account_info(),
        authority: ctx.accounts.liquidator.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, repay_amount)?;

    // Step 2: Vault sends collateral + bonus to liquidator
    let token_mint_key = ctx.accounts.token_mint.key();
    let seeds = &[b"pool", token_mint_key.as_ref(), &[pool.bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.token_vault.to_account_info(),
        to: ctx.accounts.liquidator_token_account.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, collateral_to_seize)?;

    // Update borrower position — clear interest first, then principal
    let position = &mut ctx.accounts.borrower_position;
    let mut remaining_repay = repay_amount;

    if remaining_repay >= position.accrued_interest {
        remaining_repay -= position.accrued_interest;
        position.accrued_interest = 0;
    } else {
        position.accrued_interest -= remaining_repay;
        remaining_repay = 0;
    }

    position.borrowed_amount = position
        .borrowed_amount
        .checked_sub(remaining_repay)
        .ok_or(ShieldFiError::MathOverflow)?;

    position.deposited_amount = position
        .deposited_amount
        .checked_sub(collateral_to_seize)
        .ok_or(ShieldFiError::MathOverflow)?;

    position.last_update_slot = Clock::get()?.slot;

    // Update pool totals
    let pool = &mut ctx.accounts.pool;
    pool.total_borrows = pool.total_borrows.saturating_sub(remaining_repay);
    pool.total_deposits = pool.total_deposits.saturating_sub(collateral_to_seize);

    msg!(
        "Liquidation: {} repaid, {} collateral seized, health was {}",
        repay_amount,
        collateral_to_seize,
        health
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,

    /// CHECK: We only read their position PDA
    pub borrower: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"pool", token_mint.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, LendingPool>,

    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), borrower.key().as_ref()],
        bump = borrower_position.bump,
        constraint = borrower_position.owner == borrower.key()
    )]
    pub borrower_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = liquidator_token_account.mint == token_mint.key(),
        constraint = liquidator_token_account.owner == liquidator.key()
    )]
    pub liquidator_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: Verified inside instruction via pool.oracle comparison
    pub oracle: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

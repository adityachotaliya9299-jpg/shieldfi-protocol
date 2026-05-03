use anchor_lang::prelude::*;
use crate::errors::ShieldFiError;

/// Price precision — all prices normalized to 6 decimals
/// e.g. 1_000_000 = $1.00
pub const PRICE_PRECISION: u64 = 1_000_000;

/// Max age of price data in slots before we reject it
pub const MAX_PRICE_AGE_SLOTS: u64 = 75;

/// Oracle price data stored in a PDA account
/// In production this reads from Pyth network price feeds
/// Architecture is Pyth-compatible — swap read_price_feed()
/// with SolanaPriceAccount::account_info_to_feed() on mainnet
#[account]
pub struct OraclePriceAccount {
    /// Authority who can update this price (admin or Pyth CPI)
    pub authority: Pubkey,
    /// Token mint this price feed is for
    pub token_mint: Pubkey,
    /// Price in USD normalized to 6 decimals (e.g. 1_000_000 = $1.00)
    pub price: u64,
    /// Confidence interval in same units as price
    pub confidence: u64,
    /// Slot when price was last updated
    pub last_update_slot: u64,
    /// Whether this feed is active
    pub is_active: bool,
    /// PDA bump
    pub bump: u8,
}

impl OraclePriceAccount {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // token_mint
        + 8   // price
        + 8   // confidence
        + 8   // last_update_slot
        + 1   // is_active
        + 1;  // bump
}

/// Validate and return price from our oracle PDA account
/// Guards:
///   1. Feed must be active
///   2. Price must be positive
///   3. Confidence interval must be <= 2% of price (anti-manipulation)
///   4. Price must not be stale (updated within MAX_PRICE_AGE_SLOTS)
pub fn get_validated_price(
    oracle_account: &Account<OraclePriceAccount>,
    current_slot: u64,
) -> Result<u64> {
    // Guard 1: Feed must be active
    require!(oracle_account.is_active, ShieldFiError::InvalidOraclePrice);

    // Guard 2: Price must be positive
    require!(oracle_account.price > 0, ShieldFiError::InvalidOraclePrice);

    // Guard 3: Confidence interval check — reject if conf > 2% of price
    // This protects against low-liquidity and oracle manipulation attacks
    let confidence_threshold = oracle_account
        .price
        .checked_div(50)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(
        oracle_account.confidence <= confidence_threshold,
        ShieldFiError::OracleConfidenceTooWide
    );

    // Guard 4: Staleness check
    let slots_elapsed = current_slot.saturating_sub(oracle_account.last_update_slot);
    require!(
        slots_elapsed <= MAX_PRICE_AGE_SLOTS,
        ShieldFiError::StaleOraclePrice
    );

    Ok(oracle_account.price)
}

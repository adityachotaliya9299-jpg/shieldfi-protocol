use anchor_lang::prelude::*;
use pyth_sdk_solana::state::SolanaPriceAccount;

use crate::errors::ShieldFiError;

/// Max age of a price feed before we reject it (30 seconds in slots)
pub const MAX_PRICE_AGE_SLOTS: u64 = 75;

/// Price precision — all prices normalized to 6 decimals
pub const PRICE_PRECISION: u64 = 1_000_000;

/// Fetch and validate price from a Pyth price account
/// Returns price normalized to 6 decimal places
pub fn get_validated_price(
    price_account: &AccountInfo,
    current_slot: u64,
) -> Result<u64> {
    // Load the Pyth price feed
    let price_feed = SolanaPriceAccount::account_info_to_feed(price_account)
        .map_err(|_| error!(ShieldFiError::InvalidOraclePrice))?;

    // Get current price — rejects stale feeds automatically
    let current_price = price_feed
        .get_price_no_older_than(
            &pyth_sdk_solana::Price::default(),
            current_slot as i64,
            MAX_PRICE_AGE_SLOTS as u64,
        )
        .ok_or(ShieldFiError::StaleOraclePrice)?;

    // Must be positive
    require!(current_price.price > 0, ShieldFiError::InvalidOraclePrice);

    // Confidence interval check — reject if conf > 2% of price
    // This guards against oracle manipulation / low liquidity moments
    let confidence_threshold = (current_price.price as u64)
        .checked_div(50)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(
        (current_price.conf as u64) <= confidence_threshold,
        ShieldFiError::OracleConfidenceTooWide
    );

    // Normalize to 6 decimals
    let normalized = normalize_price(
        current_price.price as u64,
        current_price.expo,
    )?;

    Ok(normalized)
}

/// Normalize Pyth price to 6 decimal fixed point
fn normalize_price(raw_price: u64, expo: i32) -> Result<u64> {
    // Pyth expo is typically negative (e.g. -8 means price * 10^-8)
    // We want 6 decimals so target expo = -6
    let target_expo: i32 = -6;
    let expo_diff = expo - target_expo;

    if expo_diff >= 0 {
        // Need to multiply
        let multiplier = 10u64
            .checked_pow(expo_diff as u32)
            .ok_or(ShieldFiError::MathOverflow)?;
        raw_price
            .checked_mul(multiplier)
            .ok_or(error!(ShieldFiError::MathOverflow))
    } else {
        // Need to divide
        let divisor = 10u64
            .checked_pow((-expo_diff) as u32)
            .ok_or(ShieldFiError::MathOverflow)?;
        Ok(raw_price.checked_div(divisor).unwrap_or(0))
    }
}

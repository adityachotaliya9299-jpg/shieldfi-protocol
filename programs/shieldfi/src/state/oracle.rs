use anchor_lang::prelude::*;
use pyth_sdk_solana::state::SolanaPriceAccount;

use crate::errors::ShieldFiError;

/// Max age of a Pyth price feed in seconds before we reject it (30 seconds)
pub const MAX_PRICE_AGE_SECS: u64 = 30;

/// All prices normalized to 6 decimal places
pub const PRICE_PRECISION: u64 = 1_000_000;

/// Fetch and validate a Pyth price feed from a raw account
/// Returns price normalized to 6 decimal places (e.g. 1_000_000 = $1.00)
pub fn get_validated_price(
    price_account: &AccountInfo,
    current_time: i64,
) -> Result<u64> {
    // Load price feed from account — pyth 0.8.0 accepts solana_program AccountInfo
    let price_feed = SolanaPriceAccount::account_info_to_feed(price_account)
        .map_err(|_| error!(ShieldFiError::InvalidOraclePrice))?;

    // get_price_no_older_than(current_unix_timestamp, max_age_seconds)
    let current_price = price_feed
        .get_price_no_older_than(current_time, MAX_PRICE_AGE_SECS)
        .ok_or(error!(ShieldFiError::StaleOraclePrice))?;

    // Price must be positive
    require!(current_price.price > 0, ShieldFiError::InvalidOraclePrice);

    // Confidence interval check — reject if conf > 2% of price
    // Guards against oracle manipulation and low-liquidity attacks
    let confidence_threshold = (current_price.price as u64)
        .checked_div(50)
        .ok_or(ShieldFiError::MathOverflow)?;

    require!(
        (current_price.conf as u64) <= confidence_threshold,
        ShieldFiError::OracleConfidenceTooWide
    );

    // Normalize to 6 decimals
    let normalized = normalize_price(current_price.price as u64, current_price.expo)?;

    Ok(normalized)
}

/// Normalize Pyth raw price to 6 decimal fixed point
/// Pyth expo is typically negative (e.g. -8 means price * 10^-8)
/// We want 6 decimals so target expo = -6
fn normalize_price(raw_price: u64, expo: i32) -> Result<u64> {
    let target_expo: i32 = -6;
    let expo_diff = expo - target_expo;

    if expo_diff >= 0 {
        let multiplier = 10u64
            .checked_pow(expo_diff as u32)
            .ok_or(ShieldFiError::MathOverflow)?;
        raw_price
            .checked_mul(multiplier)
            .ok_or(error!(ShieldFiError::MathOverflow))
    } else {
        let divisor = 10u64
            .checked_pow((-expo_diff) as u32)
            .ok_or(ShieldFiError::MathOverflow)?;
        Ok(raw_price.checked_div(divisor).unwrap_or(0))
    }
}

use anchor_lang::prelude::*;

#[error_code]
pub enum ShieldFiError {
    #[msg("Protocol is currently paused by admin")]
    ProtocolPaused,

    #[msg("Insufficient collateral to cover this borrow")]
    InsufficientCollateral,

    #[msg("Position is healthy — liquidation not allowed")]
    PositionHealthy,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Borrow amount exceeds available pool liquidity")]
    InsufficientLiquidity,

    #[msg("Unauthorized: caller is not the pool authority")]
    Unauthorized,

    #[msg("Invalid config: collateral_factor must be < liquidation_threshold")]
    InvalidPoolConfig,

    #[msg("Arithmetic overflow detected")]
    MathOverflow,

    #[msg("Repay amount exceeds outstanding debt")]
    RepayExceedsDebt,

    #[msg("Withdrawal amount exceeds deposited balance")]
    WithdrawExceedsDeposit,
}

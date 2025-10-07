use anchor_lang::prelude::*;

#[error_code]
pub enum DdError {
    #[msg("Paused")]
    Paused,
    #[msg("Round not ended yet")]
    RoundNotEnded,
    #[msg("Already nuked this round")]
    NukeAlreadyUsed,
    #[msg("Only winner president may launch nuke")]
    NotWinnerPresident,
    #[msg("Country nuked")]
    CountryNuked,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Slippage exceeded")]
    Slippage,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Wrong market mode")]
    WrongMode,
    #[msg("Curve not frozen")]
    CurveNotFrozen,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
}

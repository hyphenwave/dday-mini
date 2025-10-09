use crate::state::MarketMode;
use anchor_lang::prelude::*;

#[event]
pub struct BoughtOnCurve {
    pub round: u32,
    pub country: u16,
    pub buyer: Pubkey,
    pub sol_in: u64,
    pub tokens_out: u64,
    pub price_bp: u64,
}

#[event]
pub struct SoldOnCurve {
    pub round: u32,
    pub country: u16,
    pub seller: Pubkey,
    pub tokens_in: u64,
    pub sol_out: u64,
    pub price_bp: u64,
}

#[event]
pub struct PresidentUpdated {
    pub country: u16,
    pub president: Pubkey,
    pub top_holder: u64,
}

#[event]
pub struct RoundEnded {
    pub round_index: u32,
    pub winner_country_id: u16,
}

#[event]
pub struct NukeLaunched {
    pub round_index: u32,
    pub winner_country_id: u16,
    pub target_country_id: u16,
    pub random_country_id: u16,
    pub sol_pulled: u64,
    pub to_winner_buyback: u64,
    pub to_random_buyback: u64,
    pub winner_tokens_burned: u64,
    pub random_tokens_burned: u64,
}

#[event]
pub struct NukeLaunchedIndexed {
    pub round_index: u32,
    pub winner_country_id: u16,
    pub target_country_id: u16,
    pub random_country_id: u16,
}

#[event]
pub struct BondingReachedIndexed {
    pub round_index: u32,
    pub country_id: u16,
    pub treasury_lamports: u64,
}

#[event]
pub struct SecondPrizeExecuted {
    pub round_index: u32,
    pub winner_country_id: u16,
    pub sol_spent: u64,
    pub tokens_burned: u64,
    pub mode: MarketMode,
}

#[event]
pub struct CurveFrozen {
    pub country: u16,
}

#[event]
pub struct MigratedToAmm {
    pub country: u16,
    pub pool_state: Pubkey,
    pub at: i64,
}

#[event]
pub struct CountryPrice {
    pub country: u16,
    pub mode: MarketMode,
    pub price_lamports_per_token: u64,
    pub step_index: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CountryPriceReturn {
    pub price_lamports_per_token: u64,
    pub mode: MarketMode,
    pub step_index: u64,
}

use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CountryStatus {
    Active,
    Nuked,
}
impl Default for CountryStatus {
    fn default() -> Self {
        CountryStatus::Active
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketMode {
    Curve,
    Amm,
}
impl Default for MarketMode {
    fn default() -> Self {
        MarketMode::Curve
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum QuoteSource {
    Curve,
    Raydium,
    Oracle,
    Unknown,
}
impl Default for QuoteSource {
    fn default() -> Self {
        QuoteSource::Unknown
    }
}

#[account]
pub struct Global {
    pub authority: Pubkey, // upgrade/admin or oracle multisig
    pub round_index: u32,
    pub round_ends_at_unix: i64,
    pub winner_country_id: u16,        // set at end_round
    pub nuke_consumed_for_round: bool, // reset at end_round
    pub prize_pot_lamports: u64,
    pub countries_live: u16,
    pub paused: bool,
    pub bump: u8,
    // Second prize lifecycle
    pub second_prize_claimed_round: u32, // round index that claimed the second prize (0 = none)
}

#[account]
pub struct Country {
    // Identity & status
    pub id: u16, // 1..=211
    pub status: CountryStatus,
    pub paused: bool,
    pub mode: MarketMode,   // Curve → Amm after migration
    pub curve_frozen: bool, // true once threshold reached before migration

    // Token & treasuries
    pub mint: Pubkey,         // Token-2022 mint
    pub token_vault: Pubkey,  // ATA owned by AUTH PDA
    pub sol_treasury: Pubkey, // System account PDA holding lamports

    // Curve state
    pub virtual_sol: u128,
    pub virtual_token: u128,
    pub supply_minted: u64,
    pub supply_burned: u64,
    pub curve_fee_bp: u64,

    // Step-curve parameters (Pump.fun style)
    pub step_tokens: u64,                 // tokens per step bucket
    pub step_base_price_lamports: u64,    // price per token at step 0
    pub curve_slope_per_token_sq_e6: u64, // price increment per step
    pub current_step_index: u64,          // current step bucket index
    pub sold_in_current_step: u64,        // tokens sold within current step

    // Presidency (off-chain maintained)
    pub president: Pubkey,
    pub top_holder_cached: u64, // free-balance cache for UI

    // Migration metadata
    pub migrate_threshold_usd_e6: u64,
    pub raydium_pool_state: Pubkey,
    pub raydium_vault_a: Pubkey, // token vault (country mint)
    pub raydium_vault_b: Pubkey, // quote vault (WSOL)
    pub raydium_program: Pubkey,
    pub migrated_at_ts: i64,

    // Quote cache (optional, off-chain maintained)
    pub quote_price_q64: u128, // lamports/token in Q64.64
    pub quote_marketcap: u128,
    pub quote_source: QuoteSource,
    pub quote_observed_at: i64,

    pub bump: u8,
}

#[account]
pub struct Authorities {
    pub burn_mint_auth_bump: u8, // signer for mint/burn & vault control
    pub bump: u8,
}

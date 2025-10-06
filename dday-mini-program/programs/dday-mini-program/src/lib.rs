// WorldPvP — Pump-style curve → migrate-to-AMM (Raydium) — Production On-chain
// ---------------------------------------------------------------------------------
// Key choices for simplicity & reliability:
// - Curve phase: internal bonding curve (SOL treasury PDA + token vault ATA).
// - Migration: freeze curve, transfer seeding liquidity (SOL + tokens) to a
//   designated seeding wallet/token-account (your off-chain service wraps SOL
//   to WSOL and calls Raydium create/add-liquidity). Then switch mode = Amm.
// - Presidency: off-chain top free-balance scanner updates `country.president`.
// - Quotes: optional off-chain price/marketcap cache (for UI / end_round input).
// - Nuke: unchanged — rug % of target treasury; split buy&burn + donate.
// - Safety: global & per-country pause, one nuke per round, deterministic PDAs.
//
// * Token-2022 is used for country mints. WSOL is SPL Token classic off-chain.
// ---------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

declare_id!("CS5ZMcpfdSS7WTgTQp7xYeVN9af3UoAdrZyMgKr3s8Bt");
use anchor_lang::prelude::AccountInfo;
use anchor_lang::prelude::InterfaceAccount;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

// -----------------------------
// Constants & Seeds
// -----------------------------

pub const MAX_COUNTRIES: u16 = 211;
pub const BASIS_POINTS: u64 = 10_000; // 100% = 10000 bp

pub const GLOBAL_TAX_BP: u64 = 50; // 0.50% to global prize pot
pub const CURVE_FEE_BP_DEFAULT: u64 = 100; // 1.00% protocol fee (kept in treasury)
pub const NUKE_RUG_BP: u64 = 10_000; // 100% of target SOL treasury is rugged
pub const TOKEN_DECIMALS: u8 = 9; // All country mints use 9 decimals
pub const MIGRATE_THRESHOLD_USD_E6_DEFAULT: u64 = 80_000_000; // $80k in 1e6 precision

const GLOBAL_SEED: &[u8] = b"GLOBAL";
const COUNTRY_SEED: &[u8] = b"COUNTRY"; // + id.le_bytes()
const TREASURY_SEED: &[u8] = b"TREASURY"; // + id.le_bytes()
const AUTH_SEED: &[u8] = b"AUTH"; // mint/burn authority PDA (stores bumps)

// -----------------------------
// Types & Accounts
// -----------------------------

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
    pub step_tokens: u64,                   // tokens per step bucket
    pub step_base_price_lamports: u64,      // price per token at step 0
    pub step_price_increment_lamports: u64, // price increment per step
    pub current_step_index: u64,            // current step bucket index
    pub sold_in_current_step: u64,          // tokens sold within current step

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

// -----------------------------
// Errors & Events
// -----------------------------

#[error_code]
pub enum WpError {
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
}

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
    pub sol_rugged: u64,
    pub to_buyback: u64,
    pub to_random: u64,
}
#[event]
pub struct SecondPrizeExecuted {
    pub round_index: u32,
    pub winner_country_id: u16,
    pub sol_spent: u64,
    pub tokens_burned: u64,
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

// -----------------------------
// Program
// -----------------------------

#[program]
pub mod world_pvp {
    use super::*;

    // removed: helper functions were causing fallback conflicts

    // ===== Bootstrap =====
    pub fn init_global(ctx: Context<InitGlobal>, round_ends_at_unix: i64) -> Result<()> {
        let g = &mut ctx.accounts.global;
        g.authority = ctx.accounts.authority.key();
        g.round_index = 1;
        g.round_ends_at_unix = round_ends_at_unix;
        g.winner_country_id = 0;
        g.nuke_consumed_for_round = false;
        g.prize_pot_lamports = 0;
        g.countries_live = 0;
        g.paused = false;
        g.bump = ctx.bumps.global;

        ctx.accounts.auth.burn_mint_auth_bump = ctx.bumps.burn_mint_auth;
        ctx.accounts.auth.bump = ctx.bumps.auth;
        Ok(())
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        ctx.accounts.global.paused = paused;
        Ok(())
    }

    pub fn set_country_pause(ctx: Context<SetCountryPause>, paused: bool) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        ctx.accounts.country.paused = paused;
        Ok(())
    }

    // ===== Country Setup =====
    pub fn init_country(
        ctx: Context<InitCountry>,
        id: u16,
        virtual_sol: u128,
        virtual_token: u128,
    ) -> Result<()> {
        require!(id >= 1 && id <= MAX_COUNTRIES, WpError::InvalidAmount);
        let g = &mut ctx.accounts.global;
        let c = &mut ctx.accounts.country;
        c.id = id;
        c.status = CountryStatus::Active;
        c.paused = false;
        c.mode = MarketMode::Curve;
        c.curve_frozen = false;

        c.mint = ctx.accounts.mint.key();
        c.token_vault = ctx.accounts.token_vault.key();
        c.sol_treasury = ctx.accounts.sol_treasury.key();

        c.virtual_sol = virtual_sol;
        c.virtual_token = virtual_token;
        c.supply_minted = 0;
        c.supply_burned = 0;
        c.curve_fee_bp = CURVE_FEE_BP_DEFAULT;

        // Default step-curve config (can be tuned off-chain via an admin ix if desired)
        c.step_tokens = 1_000_000; // 1M tokens per step
        c.step_base_price_lamports = 1_000; // 0.000001 SOL
        c.step_price_increment_lamports = 1_000; // +0.000001 SOL per step
        c.current_step_index = 0;
        c.sold_in_current_step = 0;

        c.president = Pubkey::default();
        c.top_holder_cached = 0;

        c.migrate_threshold_usd_e6 = MIGRATE_THRESHOLD_USD_E6_DEFAULT;
        c.raydium_pool_state = Pubkey::default();
        c.raydium_vault_a = Pubkey::default();
        c.raydium_vault_b = Pubkey::default();
        c.raydium_program = Pubkey::default();
        c.migrated_at_ts = 0;

        c.quote_price_q64 = 0;
        c.quote_marketcap = 0;
        c.quote_source = QuoteSource::Unknown;
        c.quote_observed_at = 0;

        c.bump = ctx.bumps.country;
        g.countries_live = g.countries_live.saturating_add(1);

        // Mint fixed max supply (1,000,000,000 tokens with TOKEN_DECIMALS) to the reserve vault.
        /*  let max_supply_raw: u64 =
            1_000_000_000u64.saturating_mul(10u64.saturating_pow(TOKEN_DECIMALS as u32));
        if max_supply_raw > 0 {
            let seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.bumps.burn_mint_auth]];
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::MintTo {
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.token_vault.to_account_info(),
                        authority: ctx.accounts.burn_mint_auth.to_account_info(),
                    },
                    &[seeds],
                ),
                max_supply_raw,
            )?;
            c.supply_minted = c.supply_minted.saturating_add(max_supply_raw);
        }*/
        Ok(())
    }

    // ===== Curve Trading =====
    pub fn buy_on_curve(ctx: Context<BuyOnCurve>, min_tokens_out: u64, sol_in: u64) -> Result<()> {
        require!(!ctx.accounts.global.paused, WpError::Paused);
        require!(!ctx.accounts.country.paused, WpError::Paused);
        require!(
            matches!(ctx.accounts.country.status, CountryStatus::Active),
            WpError::CountryNuked
        );
        require!(
            matches!(ctx.accounts.country.mode, MarketMode::Curve)
                && !ctx.accounts.country.curve_frozen,
            WpError::WrongMode
        );
        require!(sol_in > 0, WpError::InvalidAmount);

        // user → treasury (SOL)
        let payer = &ctx.accounts.payer;
        let treasury = &ctx.accounts.sol_treasury;
        **payer.to_account_info().try_borrow_mut_lamports()? -= sol_in;
        **treasury.to_account_info().try_borrow_mut_lamports()? += sol_in;

        // global tax → Global PDA
        let global_tax = (sol_in as u128 * (GLOBAL_TAX_BP as u128) / (BASIS_POINTS as u128)) as u64;
        if global_tax > 0 {
            **treasury.to_account_info().try_borrow_mut_lamports()? -= global_tax;
            **ctx
                .accounts
                .global_account
                .to_account_info()
                .try_borrow_mut_lamports()? += global_tax;
            ctx.accounts.global.prize_pot_lamports = ctx
                .accounts
                .global
                .prize_pot_lamports
                .saturating_add(global_tax);
        }

        // step-curve pricing using fixed-supply transfers from reserve vault
        let mut tokens_remaining_to_sell = min_tokens_out; // minimum target in tokens
        let mut sol_budget = (sol_in - global_tax) as u64;
        let mut tokens_to_send: u64 = 0;

        // compute available in vault
        let mut vault_amount = accessor::amount(&ctx.accounts.token_vault.to_account_info())?;
        require!(vault_amount > 0, WpError::InvalidAmount);

        while tokens_remaining_to_sell > 0 && sol_budget > 0 && vault_amount > 0 {
            let step_size = ctx.accounts.country.step_tokens;
            let step_sold = ctx.accounts.country.sold_in_current_step;
            let remaining_in_step = step_size.saturating_sub(step_sold);
            if remaining_in_step == 0 {
                // advance step price bucket
                ctx.accounts.country.current_step_index =
                    ctx.accounts.country.current_step_index.saturating_add(1);
                ctx.accounts.country.sold_in_current_step = 0;
                continue;
            }

            let price_per_token = ctx
                .accounts
                .country
                .step_base_price_lamports
                .saturating_add(
                    ctx.accounts
                        .country
                        .current_step_index
                        .saturating_mul(ctx.accounts.country.step_price_increment_lamports),
                );
            if price_per_token == 0 {
                break;
            }
            // max tokens purchasable by budget and step capacity and vault balance
            let by_budget = sol_budget / price_per_token;
            let can_buy_now = by_budget.min(remaining_in_step).min(vault_amount);
            if can_buy_now == 0 {
                break;
            }
            let cost = can_buy_now.saturating_mul(price_per_token);
            sol_budget = sol_budget.saturating_sub(cost);
            tokens_to_send = tokens_to_send.saturating_add(can_buy_now);
            tokens_remaining_to_sell = tokens_remaining_to_sell.saturating_sub(can_buy_now);
            ctx.accounts.country.sold_in_current_step = ctx
                .accounts
                .country
                .sold_in_current_step
                .saturating_add(can_buy_now);
            vault_amount = vault_amount.saturating_sub(can_buy_now);
        }

        require!(tokens_to_send >= min_tokens_out, WpError::Slippage);

        // transfer from reserve vault to buyer (AUTH signer) with decimals
        let seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.buyer_ata.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            tokens_to_send,
            TOKEN_DECIMALS,
        )?;

        let round_index = ctx.accounts.global.round_index;
        let country_id = ctx.accounts.country.id;
        emit!(BoughtOnCurve {
            round: round_index,
            country: country_id,
            buyer: payer.key(),
            sol_in,
            tokens_out: tokens_to_send,
            price_bp: 0
        });
        Ok(())
    }

    pub fn sell_on_curve(
        ctx: Context<SellOnCurve>,
        min_sol_out: u64,
        tokens_in: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.global.paused, WpError::Paused);
        require!(!ctx.accounts.country.paused, WpError::Paused);
        require!(
            matches!(ctx.accounts.country.status, CountryStatus::Active),
            WpError::CountryNuked
        );
        require!(
            matches!(ctx.accounts.country.mode, MarketMode::Curve)
                && !ctx.accounts.country.curve_frozen,
            WpError::WrongMode
        );
        require!(tokens_in > 0, WpError::InvalidAmount);

        // transfer tokens back to reserve vault (checked)
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.seller_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            tokens_in,
            TOKEN_DECIMALS,
        )?;

        // compute SOL out
        // step price-based payout: pay at current bucket price downward
        let mut tokens_remaining = tokens_in;
        let mut sol_out_u64: u64 = 0;
        while tokens_remaining > 0 {
            let step_sold = ctx.accounts.country.sold_in_current_step;
            let consumed_in_step = step_sold.min(ctx.accounts.country.step_tokens);
            if consumed_in_step == 0 {
                // nothing sold in current step, move back one step if possible
                if ctx.accounts.country.current_step_index == 0 {
                    break;
                }
                ctx.accounts.country.current_step_index =
                    ctx.accounts.country.current_step_index.saturating_sub(1);
                ctx.accounts.country.sold_in_current_step = ctx.accounts.country.step_tokens;
                continue;
            }
            let available_to_buyback = consumed_in_step.min(tokens_remaining);
            let price_per_token = ctx
                .accounts
                .country
                .step_base_price_lamports
                .saturating_add(
                    ctx.accounts
                        .country
                        .current_step_index
                        .saturating_mul(ctx.accounts.country.step_price_increment_lamports),
                );
            sol_out_u64 =
                sol_out_u64.saturating_add(available_to_buyback.saturating_mul(price_per_token));
            tokens_remaining = tokens_remaining.saturating_sub(available_to_buyback);
            ctx.accounts.country.sold_in_current_step = ctx
                .accounts
                .country
                .sold_in_current_step
                .saturating_sub(available_to_buyback);
            if ctx.accounts.country.sold_in_current_step == 0
                && ctx.accounts.country.current_step_index > 0
            {
                ctx.accounts.country.current_step_index =
                    ctx.accounts.country.current_step_index.saturating_sub(1);
                ctx.accounts.country.sold_in_current_step = ctx.accounts.country.step_tokens;
            }
        }
        require!(
            sol_out_u64 >= min_sol_out && sol_out_u64 > 0,
            WpError::Slippage
        );

        // global tax on sell
        let global_tax =
            (sol_out_u64 as u128 * (GLOBAL_TAX_BP as u128) / (BASIS_POINTS as u128)) as u64;
        let seller_amount = sol_out_u64.saturating_sub(global_tax);

        if global_tax > 0 {
            **ctx
                .accounts
                .sol_treasury
                .to_account_info()
                .try_borrow_mut_lamports()? -= global_tax;
            **ctx
                .accounts
                .global
                .to_account_info()
                .try_borrow_mut_lamports()? += global_tax;
            ctx.accounts.global.prize_pot_lamports = ctx
                .accounts
                .global
                .prize_pot_lamports
                .saturating_add(global_tax);
        }

        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= seller_amount;
        **ctx
            .accounts
            .seller
            .to_account_info()
            .try_borrow_mut_lamports()? += seller_amount;

        let round_index = ctx.accounts.global.round_index;
        let country_id = ctx.accounts.country.id;
        emit!(SoldOnCurve {
            round: round_index,
            country: country_id,
            seller: ctx.accounts.seller.key(),
            tokens_in,
            sol_out: sol_out_u64,
            price_bp: 0
        });
        Ok(())
    }

    // ===== Migration controls =====
    pub fn freeze_curve(ctx: Context<FreezeCurve>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        let c = &mut ctx.accounts.country;
        require!(matches!(c.mode, MarketMode::Curve), WpError::WrongMode);
        c.curve_frozen = true;
        emit!(CurveFrozen { country: c.id });
        Ok(())
    }

    /// Transfers seeding liquidity into program-owned custody (PDA) and records Raydium pool.
    /// SOL moves from country treasury to the program signer PDA; tokens move from program vault
    /// to a PDA-owned token account. This ensures the program owns liquidity and can later
    /// add/remove liquidity via CPI. Finally, it records Raydium pool addresses and flips mode → Amm.
    pub fn seed_raydium_pool(
        ctx: Context<SeedRaydiumPool>,
        raydium_program: Pubkey,
        pool_state: Pubkey,
        raydium_vault_a: Pubkey,
        raydium_vault_b: Pubkey,
        raydium_ix_data: Vec<u8>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        let c = &mut ctx.accounts.country;
        require!(matches!(c.mode, MarketMode::Curve), WpError::WrongMode);
        require!(c.curve_frozen, WpError::CurveNotFrozen);

        // Move all SOL from treasury to the program PDA (burn_mint_auth)
        let available_sol = ctx.accounts.sol_treasury.lamports();
        if available_sol > 0 {
            **ctx
                .accounts
                .sol_treasury
                .to_account_info()
                .try_borrow_mut_lamports()? -= available_sol;
            **ctx
                .accounts
                .burn_mint_auth
                .to_account_info()
                .try_borrow_mut_lamports()? += available_sol;
        }

        // Move all tokens from program vault (owned by AUTH PDA) to the PDA-owned liquidity token account
        let token_seed_amount = accessor::amount(&ctx.accounts.token_vault.to_account_info())?;
        if token_seed_amount > 0 {
            let seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::TransferChecked {
                        from: ctx.accounts.token_vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.liquidity_token_account.to_account_info(),
                        authority: ctx.accounts.burn_mint_auth.to_account_info(),
                    },
                    &[seeds],
                ),
                token_seed_amount,
                TOKEN_DECIMALS,
            )?;
        }

        // Raydium CPI (optional): if instruction data provided, forward to Raydium
        if !raydium_ix_data.is_empty() {
            let metas: Vec<AccountMeta> = ctx
                .remaining_accounts
                .iter()
                .map(|ai| {
                    let mut is_signer = ai.is_signer;
                    if ai.key == ctx.accounts.burn_mint_auth.key {
                        is_signer = true;
                    }
                    AccountMeta {
                        pubkey: *ai.key,
                        is_signer,
                        is_writable: ai.is_writable,
                    }
                })
                .collect();
            let ix = Instruction {
                program_id: raydium_program,
                accounts: metas,
                data: raydium_ix_data,
            };
            let signer_seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            invoke_signed(&ix, ctx.remaining_accounts, &[signer_seeds])?;
        }

        // Record canonical pool and flip mode
        c.raydium_program = raydium_program;
        c.raydium_pool_state = pool_state;
        c.raydium_vault_a = raydium_vault_a;
        c.raydium_vault_b = raydium_vault_b;
        c.mode = MarketMode::Amm;
        c.curve_frozen = false;
        c.migrated_at_ts = Clock::get()?.unix_timestamp;

        emit!(MigratedToAmm {
            country: c.id,
            pool_state,
            at: c.migrated_at_ts
        });
        Ok(())
    }

    // ===== Presidency & Quotes (off-chain driven) =====
    pub fn set_president_offchain(
        ctx: Context<SetPresidentOffchain>,
        new_president: Pubkey,
        holder_amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.updater.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        let c = &mut ctx.accounts.country;
        require!(
            matches!(c.status, CountryStatus::Active),
            WpError::CountryNuked
        );
        c.president = new_president;
        c.top_holder_cached = holder_amount;
        emit!(PresidentUpdated {
            country: c.id,
            president: new_president,
            top_holder: holder_amount
        });
        Ok(())
    }

    pub fn set_country_quote_offchain(
        ctx: Context<SetCountryQuoteOffchain>,
        price_q64: u128,
        marketcap: u128,
        source: QuoteSource,
        observed_at: i64,
    ) -> Result<()> {
        require!(
            ctx.accounts.updater.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        let c = &mut ctx.accounts.country;
        c.quote_price_q64 = price_q64;
        c.quote_marketcap = marketcap;
        c.quote_source = source;
        c.quote_observed_at = observed_at;
        Ok(())
    }

    // ===== Round & Nuke =====
    pub fn end_round(
        ctx: Context<EndRound>,
        winner_country_id: u16,
        next_end_unix: i64,
    ) -> Result<()> {
        let g = &mut ctx.accounts.global;
        require!(
            ctx.accounts.authority.key() == g.authority,
            WpError::Unauthorized
        );
        require!(
            Clock::get()?.unix_timestamp >= g.round_ends_at_unix,
            WpError::RoundNotEnded
        );
        g.winner_country_id = winner_country_id;
        g.nuke_consumed_for_round = false;
        emit!(RoundEnded {
            round_index: g.round_index,
            winner_country_id
        });
        g.round_index = g.round_index.saturating_add(1);
        g.round_ends_at_unix = next_end_unix;
        Ok(())
    }

    pub fn launch_nuke(
        ctx: Context<LaunchNuke>,
        target_country_id: u16,
        random_country_id: u16,
        _raydium_ix_data: Option<Vec<u8>>,
    ) -> Result<()> {
        let g = &mut ctx.accounts.global;
        require!(!g.paused, WpError::Paused);
        require!(!g.nuke_consumed_for_round, WpError::NukeAlreadyUsed);
        require!(
            g.winner_country_id == ctx.accounts.winner_country.id,
            WpError::NotWinnerPresident
        );
        require!(
            ctx.accounts.winner_country.president == ctx.accounts.president.key(),
            WpError::NotWinnerPresident
        );

        let target = &mut ctx.accounts.target_country;
        require!(
            matches!(target.status, CountryStatus::Active),
            WpError::CountryNuked
        );

        // Rug % of target treasury
        let treasury = &ctx.accounts.target_sol_treasury;
        let sol_rug =
            (treasury.lamports() as u128 * (NUKE_RUG_BP as u128) / (BASIS_POINTS as u128)) as u64;
        **treasury.to_account_info().try_borrow_mut_lamports()? -= sol_rug;

        let buyback = sol_rug / 2;
        let to_random = sol_rug - buyback;

        // 50% buy&burn winner
        let mut burned: u64 = 0;
        if matches!(ctx.accounts.winner_country.mode, MarketMode::Amm) {
            if let Some(data) = _raydium_ix_data {
                // Validate pool accounts presence in remaining
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_pool_state
                    ),
                    WpError::Unauthorized
                );
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_vault_a
                    ),
                    WpError::Unauthorized
                );
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_vault_b
                    ),
                    WpError::Unauthorized
                );

                let before = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
                let signer_seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
                cpi_raydium_swap(
                    ctx.accounts.winner_country.raydium_program,
                    ctx.remaining_accounts,
                    signer_seeds,
                    data,
                )?;
                let after = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
                let delta = after.saturating_sub(before);
                if delta > 0 {
                    // Burn acquired tokens from vault
                    token::burn(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            token::Burn {
                                mint: ctx.accounts.winner_mint.to_account_info(),
                                from: ctx.accounts.winner_token_vault.to_account_info(),
                                authority: ctx.accounts.burn_mint_auth.to_account_info(),
                            },
                            &[signer_seeds],
                        ),
                        delta,
                    )?;
                    ctx.accounts.winner_country.supply_burned = ctx
                        .accounts
                        .winner_country
                        .supply_burned
                        .saturating_add(delta);
                    burned = delta;
                }
            }
        }
        if burned == 0 {
            burned = internal_buy_and_burn(
                &ctx.accounts.token_program,
                &ctx.accounts.winner_mint,
                &ctx.accounts.winner_token_vault,
                &ctx.accounts.winner_sol_treasury,
                &ctx.accounts.burn_mint_auth,
                &ctx.accounts.auth,
                &mut ctx.accounts.winner_country,
                buyback,
            )?;
        }
        // donate the rest
        **ctx
            .accounts
            .random_country_sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += to_random;

        target.status = CountryStatus::Nuked;
        g.nuke_consumed_for_round = true;
        g.countries_live = g.countries_live.saturating_sub(1);

        emit!(NukeLaunched {
            round_index: g.round_index,
            winner_country_id: ctx.accounts.winner_country.id,
            target_country_id,
            sol_rugged: sol_rug,
            to_buyback: buyback,
            to_random
        });
        Ok(())
    }

    pub fn execute_second_prize(
        ctx: Context<ExecuteSecondPrize>,
        _raydium_ix_data: Option<Vec<u8>>,
    ) -> Result<()> {
        let g = &mut ctx.accounts.global;
        require!(!g.paused, WpError::Paused);
        let pot = g.prize_pot_lamports;
        require!(pot > 0, WpError::InvalidAmount);

        **ctx
            .accounts
            .global_account
            .to_account_info()
            .try_borrow_mut_lamports()? -= pot;
        **ctx
            .accounts
            .winner_sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += pot;
        g.prize_pot_lamports = 0;

        let mut burned: u64 = 0;
        if matches!(ctx.accounts.winner_country.mode, MarketMode::Amm) {
            if let Some(data) = _raydium_ix_data {
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_pool_state
                    ),
                    WpError::Unauthorized
                );
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_vault_a
                    ),
                    WpError::Unauthorized
                );
                require!(
                    accounts_contains(
                        ctx.remaining_accounts,
                        &ctx.accounts.winner_country.raydium_vault_b
                    ),
                    WpError::Unauthorized
                );

                let before = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
                let signer_seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
                cpi_raydium_swap(
                    ctx.accounts.winner_country.raydium_program,
                    ctx.remaining_accounts,
                    signer_seeds,
                    data,
                )?;
                let after = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
                let delta = after.saturating_sub(before);
                if delta > 0 {
                    token::burn(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            token::Burn {
                                mint: ctx.accounts.winner_mint.to_account_info(),
                                from: ctx.accounts.winner_token_vault.to_account_info(),
                                authority: ctx.accounts.burn_mint_auth.to_account_info(),
                            },
                            &[signer_seeds],
                        ),
                        delta,
                    )?;
                    ctx.accounts.winner_country.supply_burned = ctx
                        .accounts
                        .winner_country
                        .supply_burned
                        .saturating_add(delta);
                    burned = delta;
                }
            }
        }
        if burned == 0 {
            burned = internal_buy_and_burn(
                &ctx.accounts.token_program,
                &ctx.accounts.winner_mint,
                &ctx.accounts.winner_token_vault,
                &ctx.accounts.winner_sol_treasury,
                &ctx.accounts.burn_mint_auth,
                &ctx.accounts.auth,
                &mut ctx.accounts.winner_country,
                pot,
            )?;
        }
        emit!(SecondPrizeExecuted {
            round_index: g.round_index,
            winner_country_id: ctx.accounts.winner_country.id,
            sol_spent: pot,
            tokens_burned: burned
        });
        Ok(())
    }
}

// Helpers outside program module to avoid fallback conflicts
fn accounts_contains(accs: &[AccountInfo], key: &Pubkey) -> bool {
    accs.iter().any(|ai| ai.key == key)
}

fn cpi_raydium_swap(
    raydium_program: Pubkey,
    remaining: &[AccountInfo],
    signer_seeds: &[&[u8]],
    data: Vec<u8>,
) -> Result<()> {
    let metas: Vec<AccountMeta> = remaining
        .iter()
        .map(|ai| AccountMeta {
            pubkey: *ai.key,
            is_signer: ai.is_signer,
            is_writable: ai.is_writable,
        })
        .collect();
    let ix = Instruction {
        program_id: raydium_program,
        accounts: metas,
        data,
    };
    invoke_signed(&ix, remaining, &[signer_seeds]).map_err(|e| e.into())
}

// Step-pricing model obsoletes the continuous curve helpers.

fn internal_buy_and_burn<'info>(
    token_program: &Program<'info, Token2022>,
    mint: &InterfaceAccount<'info, Mint>,
    token_vault: &InterfaceAccount<'info, TokenAccount>,
    sol_treasury: &AccountInfo<'info>,
    burn_mint_auth: &AccountInfo<'info>,
    auth: &Account<'info, Authorities>,
    country: &mut Account<'info, Country>,
    sol_in: u64,
) -> Result<u64> {
    if sol_in == 0 {
        return Ok(0);
    }

    // Credit SOL budget into the treasury (funds came from rug/second prize).
    **sol_treasury.to_account_info().try_borrow_mut_lamports()? =
        sol_treasury.lamports().saturating_add(sol_in);

    // Determine tokens to buy and burn using current step pricing.
    let mut budget = sol_in;
    let mut tokens_to_burn: u64 = 0;
    let mut vault_amount = accessor::amount(&token_vault.to_account_info())?;
    while budget > 0 && vault_amount > 0 {
        let step_size = country.step_tokens;
        let step_sold = country.sold_in_current_step;
        let remaining_in_step = step_size.saturating_sub(step_sold);
        if remaining_in_step == 0 {
            country.current_step_index = country.current_step_index.saturating_add(1);
            country.sold_in_current_step = 0;
            continue;
        }
        let price_per_token = country.step_base_price_lamports.saturating_add(
            country
                .current_step_index
                .saturating_mul(country.step_price_increment_lamports),
        );
        if price_per_token == 0 {
            break;
        }
        let by_budget = budget / price_per_token;
        let can_buy_now = by_budget.min(remaining_in_step).min(vault_amount);
        if can_buy_now == 0 {
            break;
        }
        let cost = can_buy_now.saturating_mul(price_per_token);
        budget = budget.saturating_sub(cost);
        tokens_to_burn = tokens_to_burn.saturating_add(can_buy_now);
        country.sold_in_current_step = country.sold_in_current_step.saturating_add(can_buy_now);
        vault_amount = vault_amount.saturating_sub(can_buy_now);
    }

    if tokens_to_burn == 0 {
        return Ok(0);
    }

    // Burn directly from the reserve vault (program authority signs).
    let seeds: &[&[u8]] = &[AUTH_SEED, &[auth.burn_mint_auth_bump]];
    token::burn(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::Burn {
                mint: mint.to_account_info(),
                from: token_vault.to_account_info(),
                authority: burn_mint_auth.clone(),
            },
            &[seeds],
        ),
        tokens_to_burn,
    )?;
    country.supply_burned = country.supply_burned.saturating_add(tokens_to_burn);
    Ok(tokens_to_burn)
}

// -----------------------------
// Account Contexts
// -----------------------------

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer=authority, space=8 + 200, seeds=[GLOBAL_SEED], bump)]
    pub global: Account<'info, Global>,

    // Authority PDA (stores bumps, acts as mint auth signer)
    #[account(init, payer=authority, space=8 + 8, seeds=[AUTH_SEED], bump)]
    pub auth: Account<'info, Authorities>,
    /// CHECK: signer PDA for mint authority
    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
pub struct SetCountryPause<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
#[instruction(id: u16, virtual_sol: u128, virtual_token: u128)]
pub struct InitCountry<'info> {
    #[account(mut, has_one=authority)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer=authority, space=8 + 400, seeds=[COUNTRY_SEED, &id.to_le_bytes()], bump)]
    pub country: Account<'info, Country>,

    // Token‑2022 mint (created off‑chain). Set its mint_authority to AUTH PDA.
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    // Vault ATA owned by AUTH PDA
    #[account(init, payer=authority, associated_token::mint=mint, associated_token::authority=burn_mint_auth, associated_token::token_program=token_program)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: SOL treasury PDA
    #[account(mut, seeds=[TREASURY_SEED, &id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyOnCurve<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    /// CHECK: prize pot holder (same PDA)
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global_account: UncheckedAccount<'info>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(init_if_needed, payer=payer, associated_token::mint=mint, associated_token::authority=payer, associated_token::token_program=token_program)]
    pub buyer_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: SOL treasury PDA
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    // removed duplicate mutable global; use `global` above for mutations
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellOnCurve<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub seller_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FreezeCurve<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
#[instruction(raydium_program: Pubkey, pool_state: Pubkey, raydium_vault_a: Pubkey, raydium_vault_b: Pubkey, sol_seed_lamports: u64, token_seed_amount: u64)]
pub struct SeedRaydiumPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: SOL treasury PDA (source of SOL)
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,
    // PDA-owned token account (ATA of burn_mint_auth) to hold liquidity tokens
    #[account(init_if_needed, payer=authority, associated_token::mint=mint, associated_token::authority=burn_mint_auth, associated_token::token_program=token_program)]
    pub liquidity_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPresidentOffchain<'info> {
    pub updater: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
pub struct SetCountryQuoteOffchain<'info> {
    pub updater: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
pub struct EndRound<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
#[instruction(target_country_id: u16, random_country_id: u16)]
pub struct LaunchNuke<'info> {
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    // winner
    #[account(mut, seeds=[COUNTRY_SEED, &winner_country.id.to_le_bytes()], bump=winner_country.bump)]
    pub winner_country: Account<'info, Country>,
    pub president: Signer<'info>,

    // target
    #[account(mut, seeds=[COUNTRY_SEED, &target_country.id.to_le_bytes()], bump=target_country.bump)]
    pub target_country: Account<'info, Country>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &target_country.id.to_le_bytes()], bump)]
    pub target_sol_treasury: UncheckedAccount<'info>,

    // buyback resources
    #[account(mut)]
    pub winner_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub winner_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &winner_country.id.to_le_bytes()], bump)]
    pub winner_sol_treasury: UncheckedAccount<'info>,

    /// CHECK (donation leg)
    #[account(mut, seeds=[TREASURY_SEED, &random_country_id.to_le_bytes()], bump)]
    pub random_country_sol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ExecuteSecondPrize<'info> {
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    /// CHECK
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global_account: UncheckedAccount<'info>,

    #[account(mut, seeds=[COUNTRY_SEED, &winner_country.id.to_le_bytes()], bump=winner_country.bump)]
    pub winner_country: Account<'info, Country>,
    #[account(mut)]
    pub winner_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub winner_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &winner_country.id.to_le_bytes()], bump)]
    pub winner_sol_treasury: UncheckedAccount<'info>,
    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
}

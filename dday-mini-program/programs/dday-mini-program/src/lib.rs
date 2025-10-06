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
use anchor_lang::prelude::InterfaceAccount;

// -----------------------------
// Constants & Seeds
// -----------------------------

pub const MAX_COUNTRIES: u16 = 211;
pub const BASIS_POINTS: u64 = 10_000; // 100% = 10000 bp

pub const GLOBAL_TAX_BP: u64 = 50; // 0.50% to global prize pot
pub const CURVE_FEE_BP_DEFAULT: u64 = 100; // 1.00% protocol fee (kept in treasury)
pub const NUKE_RUG_BP: u64 = 5_000; // 50% of target SOL treasury is rugged

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
        curve_fee_bp: u64,
        migrate_threshold_usd_e6: u64,
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
        c.curve_fee_bp = if curve_fee_bp == 0 {
            CURVE_FEE_BP_DEFAULT
        } else {
            curve_fee_bp
        };

        c.president = Pubkey::default();
        c.top_holder_cached = 0;

        c.migrate_threshold_usd_e6 = migrate_threshold_usd_e6;
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

        // curve math
        let (tokens_out, price_bp) = curve_tokens_out(
            &ctx.accounts.country,
            treasury.lamports() as u128,
            accessor::amount(&ctx.accounts.token_vault.to_account_info())? as u128,
            (sol_in - global_tax) as u128,
        );
        let tokens_out_u64: u64 = tokens_out.min(u64::MAX as u128) as u64;
        require!(
            tokens_out_u64 >= min_tokens_out && tokens_out_u64 > 0,
            WpError::Slippage
        );

        // mint to buyer (AUTH signer)
        let seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.buyer_ata.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            tokens_out_u64,
        )?;
        ctx.accounts.country.supply_minted = ctx
            .accounts
            .country
            .supply_minted
            .saturating_add(tokens_out_u64);

        let round_index = ctx.accounts.global.round_index;
        let country_id = ctx.accounts.country.id;
        emit!(BoughtOnCurve {
            round: round_index,
            country: country_id,
            buyer: payer.key(),
            sol_in,
            tokens_out: tokens_out_u64,
            price_bp
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

        // burn from seller
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            tokens_in,
        )?;

        // compute SOL out
        let (sol_out, price_bp) = curve_sol_out(
            &ctx.accounts.country,
            ctx.accounts.sol_treasury.lamports() as u128,
            accessor::amount(&ctx.accounts.token_vault.to_account_info())? as u128,
            tokens_in as u128,
        );
        let sol_out_u64: u64 = sol_out.min(u64::MAX as u128) as u64;
        require!(
            sol_out_u64 >= min_sol_out && sol_out_u64 > 0,
            WpError::Slippage
        );

        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= sol_out_u64;
        **ctx
            .accounts
            .seller
            .to_account_info()
            .try_borrow_mut_lamports()? += sol_out_u64;

        let round_index = ctx.accounts.global.round_index;
        let country_id = ctx.accounts.country.id;
        emit!(SoldOnCurve {
            round: round_index,
            country: country_id,
            seller: ctx.accounts.seller.key(),
            tokens_in,
            sol_out: sol_out_u64,
            price_bp
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

    /// Transfers seeding liquidity to an external seeding wallet/token account and flips to AMM.
    /// Off-chain will wrap SOL→WSOL and call Raydium add-liquidity using these funds.
    pub fn seed_raydium_pool(
        ctx: Context<SeedRaydiumPool>,
        raydium_program: Pubkey,
        pool_state: Pubkey,
        raydium_vault_a: Pubkey,
        raydium_vault_b: Pubkey,
        sol_seed_lamports: u64,
        token_seed_amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            WpError::Unauthorized
        );
        let c = &mut ctx.accounts.country;
        require!(matches!(c.mode, MarketMode::Curve), WpError::WrongMode);
        require!(c.curve_frozen, WpError::CurveNotFrozen);

        // Move SOL from treasury to the designated seeding wallet
        if sol_seed_lamports > 0 {
            **ctx
                .accounts
                .sol_treasury
                .to_account_info()
                .try_borrow_mut_lamports()? -= sol_seed_lamports;
            **ctx
                .accounts
                .seeding_wallet
                .to_account_info()
                .try_borrow_mut_lamports()? += sol_seed_lamports;
        }

        // Move tokens from program vault (owned by AUTH PDA) to the seeding token account
        if token_seed_amount > 0 {
            let seeds: &[&[u8]] = &[AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.token_vault.to_account_info(),
                        to: ctx.accounts.seeding_token_account.to_account_info(),
                        authority: ctx.accounts.burn_mint_auth.to_account_info(),
                    },
                    &[seeds],
                ),
                token_seed_amount,
            )?;
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
        let burned = internal_buy_and_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.winner_mint,
            &ctx.accounts.winner_token_vault,
            &ctx.accounts.winner_sol_treasury,
            &ctx.accounts.burn_mint_auth,
            &ctx.accounts.auth,
            &mut ctx.accounts.winner_country,
            buyback,
        )?;
        // donate the rest
        **ctx
            .accounts
            .random_country_sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += to_random;

        target.status = CountryStatus::Nuked;
        g.nuke_consumed_for_round = true;

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

    pub fn execute_second_prize(ctx: Context<ExecuteSecondPrize>) -> Result<()> {
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

        let burned = internal_buy_and_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.winner_mint,
            &ctx.accounts.winner_token_vault,
            &ctx.accounts.winner_sol_treasury,
            &ctx.accounts.burn_mint_auth,
            &ctx.accounts.auth,
            &mut ctx.accounts.winner_country,
            pot,
        )?;
        emit!(SecondPrizeExecuted {
            round_index: g.round_index,
            winner_country_id: ctx.accounts.winner_country.id,
            sol_spent: pot,
            tokens_burned: burned
        });
        Ok(())
    }
}

// -----------------------------
// Math helpers
// -----------------------------

fn curve_tokens_out(c: &Country, rs_lamports: u128, rt_tokens: u128, ds: u128) -> (u128, u64) {
    let rs = c.virtual_sol.saturating_add(rs_lamports);
    let rt = c.virtual_token.saturating_add(rt_tokens);
    // ΔT = RT * (ΔS / (RS + ΔS))
    let numerator = rt.saturating_mul(ds);
    let denom = rs.saturating_add(ds).max(1);
    let gross = numerator / denom;
    // apply curve fee
    let curve_fee_bp = c.curve_fee_bp.min(BASIS_POINTS);
    let net = gross.saturating_mul((BASIS_POINTS - curve_fee_bp) as u128) / (BASIS_POINTS as u128);
    let price_bp = price_in_bp(rs, rt);
    (net, price_bp)
}

fn curve_sol_out(c: &Country, rs_lamports: u128, rt_tokens: u128, dt: u128) -> (u128, u64) {
    let rs = c.virtual_sol.saturating_add(rs_lamports);
    let rt = c.virtual_token.saturating_add(rt_tokens);
    // ΔS = RS * (ΔT / (RT + ΔT))
    let numerator = rs.saturating_mul(dt);
    let denom = rt.saturating_add(dt).max(1);
    let gross = numerator / denom;
    let curve_fee_bp = c.curve_fee_bp.min(BASIS_POINTS);
    let net = gross.saturating_mul((BASIS_POINTS - curve_fee_bp) as u128) / (BASIS_POINTS as u128);
    let price_bp = price_in_bp(rs, rt);
    (net, price_bp)
}

fn price_in_bp(rs: u128, rt: u128) -> u64 {
    if rt == 0 {
        return 0;
    }
    let p = rs.saturating_mul(BASIS_POINTS as u128) / rt;
    p.min(u64::MAX as u128) as u64
}

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

    // Simulate a buy (no fee/tax) and burn directly from vault.
    let rs = country
        .virtual_sol
        .saturating_add(sol_treasury.lamports() as u128);
    let rt = country
        .virtual_token
        .saturating_add(accessor::amount(&token_vault.to_account_info())? as u128);
    let ds = sol_in as u128;
    let numerator = rt.saturating_mul(ds);
    let denom = rs.saturating_add(ds).max(1);
    let tokens_out = (numerator / denom).min(u64::MAX as u128) as u64;
    if tokens_out == 0 {
        return Ok(0);
    }

    let seeds: &[&[u8]] = &[AUTH_SEED, &[auth.burn_mint_auth_bump]];
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::MintTo {
                mint: mint.to_account_info(),
                to: token_vault.to_account_info(),
                authority: burn_mint_auth.clone(),
            },
            &[seeds],
        ),
        tokens_out,
    )?;
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
        tokens_out,
    )?;
    country.supply_burned = country.supply_burned.saturating_add(tokens_out);
    Ok(tokens_out)
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
#[instruction(id: u16, virtual_sol: u128, virtual_token: u128, curve_fee_bp: u64, migrate_threshold_usd_e6: u64)]
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
    /// CHECK: signer PDA for mint authority
    /// CHECK: signer PDA for mint authority
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
pub struct SeedRaydiumPool<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: SOL treasury PDA (source of SOL)
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,
    /// CHECK: Seeding wallet (EOA or program) that will wrap SOL and call Raydium
    #[account(mut)]
    pub seeding_wallet: UncheckedAccount<'info>,
    // SPL token account owned by seeding_wallet for country token
    #[account(mut)]
    pub seeding_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
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

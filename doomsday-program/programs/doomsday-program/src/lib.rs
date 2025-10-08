// Doomsday — Pump-style curve → migrate-to-AMM (Raydium) — Production On-chain
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
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

use anchor_lang::prelude::AccountInfo;
use anchor_lang::prelude::InterfaceAccount;

pub mod constants;
pub mod dd_accounts;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

pub use constants::*;
pub use errors::*;
// re-export instruction modules selectively from the module itself in #[program]
pub use dd_accounts::*;
pub use state::*;
pub use utils::*;

// -----------------------------
// Modules
// -----------------------------

// Types & Accounts moved to crate::state

// Events moved to crate::events

// -----------------------------
// Program
// -----------------------------
declare_id!("7KfFEX13WEqj8LjQm2p3causqkGRp27ejHinsHRNWrdK");
#[program]
pub mod doomsday {

    use super::*;

    // removed: helper functions were causing fallback conflicts

    // ===== Bootstrap =====
    pub fn init_global(ctx: Context<InitGlobal>, round_ends_at_unix: i64) -> Result<()> {
        crate::instructions::bootstrap::init_global(ctx, round_ends_at_unix)
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        crate::instructions::bootstrap::set_pause(ctx, paused)
    }

    pub fn set_country_pause(ctx: Context<SetCountryPause>, paused: bool) -> Result<()> {
        crate::instructions::bootstrap::set_country_pause(ctx, paused)
    }

    // ===== Protocol Treasury =====
    pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>, lamports: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global.authority,
            DdError::Unauthorized
        );
        let available = ctx.accounts.protocol_treasury.lamports();
        let amount = lamports.min(available);
        require!(amount > 0, DdError::InvalidAmount);
        **ctx
            .accounts
            .protocol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .recipient
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    // ===== Country Setup =====
    pub fn init_country(
        ctx: Context<InitCountry>,
        id: u16,
        virtual_sol: u128,
        virtual_token: u128,
    ) -> Result<()> {
        crate::instructions::bootstrap::init_country(ctx, id, virtual_sol, virtual_token)
    }

    // ===== Curve Trading =====
    pub fn buy_on_curve(ctx: Context<BuyOnCurve>, min_tokens_out: u64, sol_in: u64) -> Result<()> {
        crate::instructions::curve::buy_on_curve(ctx, min_tokens_out, sol_in)
    }

    pub fn sell_on_curve(
        ctx: Context<SellOnCurve>,
        min_sol_out: u64,
        tokens_in: u64,
    ) -> Result<()> {
        crate::instructions::curve::sell_on_curve(ctx, min_sol_out, tokens_in)
    }

    // ===== Migration controls =====
    pub fn freeze_curve(ctx: Context<FreezeCurve>) -> Result<()> {
        crate::instructions::migration::freeze_curve(ctx)
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
        crate::instructions::migration::seed_raydium_pool(
            ctx,
            raydium_program,
            pool_state,
            raydium_vault_a,
            raydium_vault_b,
            raydium_ix_data,
        )
    }

    // ===== Presidency & Quotes (off-chain driven) =====
    pub fn get_country_price(ctx: Context<GetCountryPrice>) -> Result<()> {
        crate::instructions::view::get_country_price(ctx)
    }

    pub fn get_country_price_view(ctx: Context<GetCountryPrice>) -> Result<()> {
        crate::instructions::view::get_country_price_view(ctx)
    }

    pub fn set_president_offchain(
        ctx: Context<SetPresidentOffchain>,
        new_president: Pubkey,
        top_holder_free_balance: u64,
    ) -> Result<()> {
        crate::instructions::round::set_president_offchain(
            ctx,
            new_president,
            top_holder_free_balance,
        )
    }

    pub fn set_country_quote_offchain(
        ctx: Context<SetCountryQuoteOffchain>,
        price_q64: u128,
        marketcap: u128,
        source: QuoteSource,
        observed_at: i64,
    ) -> Result<()> {
        crate::instructions::round::set_country_quote_offchain(
            ctx,
            price_q64,
            marketcap,
            source,
            observed_at,
        )
    }

    // ===== Round & Nuke =====
    pub fn end_round(
        ctx: Context<EndRound>,
        winner_country_id: u16,
        next_end_unix: i64,
    ) -> Result<()> {
        crate::instructions::round::end_round(ctx, winner_country_id, next_end_unix)
    }

    pub fn launch_nuke(
        ctx: Context<LaunchNuke>,
        target_country_id: u16,
        random_country_id: u16,
        _raydium_ix_data: Option<Vec<u8>>,
    ) -> Result<()> {
        crate::instructions::nuke::launch_nuke(
            ctx,
            target_country_id,
            random_country_id,
            _raydium_ix_data,
        )
    }

    pub fn execute_second_prize(
        ctx: Context<ExecuteSecondPrize>,
        _raydium_ix_data: Option<Vec<u8>>,
    ) -> Result<()> {
        crate::instructions::prize::execute_second_prize(ctx, _raydium_ix_data)
    }

    // ===== Updaters management (gated by any authorized updater) =====
    pub fn add_authorized_updater(
        ctx: Context<AddAuthorizedUpdater>,
        new_updater: Pubkey,
    ) -> Result<()> {
        crate::instructions::updaters::add_authorized_updater(ctx, new_updater)
    }

    pub fn remove_authorized_updater(
        ctx: Context<RemoveAuthorizedUpdater>,
        remove: Pubkey,
    ) -> Result<()> {
        crate::instructions::updaters::remove_authorized_updater(ctx, remove)
    }
}

// Step-pricing model helper

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

    // Determine tokens to buy and burn using continuous linear curve.
    // We reuse the same integral used in buy_on_curve.
    let mut budget = sol_in; // lamports available for buyback
    let mut tokens_to_burn: u64 = 0;
    let vault_amount = accessor::amount(&token_vault.to_account_info())?;

    // Curve params
    let p0: u128 = country.step_base_price_lamports as u128; // lamports/token
    let k_e6: u128 = country.curve_slope_per_token_sq_e6 as u128; // micro-lamports/token^2
    let micro: u128 = 1_000_000u128;
    let scale: u128 = 10u128.pow(crate::TOKEN_DECIMALS as u32);
    let denom: u128 = scale.saturating_mul(scale).saturating_mul(micro);

    // Fold current units
    let step_units: u64 = country.step_tokens.max(1);
    let mut u_units: u128 = crate::utils::fold_units(
        country.current_step_index,
        country.sold_in_current_step,
        step_units,
    );

    // Cost(u, q)
    #[inline(always)]
    fn cost_lamports(
        u_units: u128,
        q_units: u128,
        p0: u128,
        k_e6: u128,
        scale: u128,
        denom: u128,
    ) -> u128 {
        if q_units == 0 {
            return 0;
        }
        let term_base = (p0.saturating_mul(q_units).saturating_mul(scale))
            .saturating_mul(2)
            .saturating_mul(1_000_000);
        let term_lin = (k_e6.saturating_mul(u_units).saturating_mul(q_units)).saturating_mul(2);
        let term_quad = k_e6.saturating_mul(q_units).saturating_mul(q_units);
        let num = term_base.saturating_add(term_lin).saturating_add(term_quad);
        let den = denom.saturating_mul(2);
        crate::utils::ceil_div_u128(num, den)
    }

    // Binary search max q such that cost <= budget, bounded by vault
    let mut lo: u128 = 0;
    let mut hi: u128 = core::cmp::min(vault_amount as u128, u128::from(u64::MAX));
    if budget > 0 && hi > 0 {
        let b = budget as u128;
        while lo < hi {
            let mid = lo + (hi - lo + 1) / 2;
            let cst = cost_lamports(u_units, mid, p0, k_e6, scale, denom);
            if cst <= b {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
    }
    let q_units = lo as u64;
    if q_units == 0 {
        return Ok(0);
    }
    let _spent =
        cost_lamports(u_units, lo, p0, k_e6, scale, denom).min(u128::from(u64::MAX)) as u64;

    // Advance state by q_units (price ticks up)
    u_units = u_units.saturating_add(q_units as u128);
    let (idx, rem) = crate::utils::unfold_units(u_units, step_units);
    country.current_step_index = idx;
    country.sold_in_current_step = rem;

    tokens_to_burn = q_units;

    if tokens_to_burn == 0 {
        return Ok(0);
    }

    // Burn directly from the reserve vault (program authority signs).
    let seeds: &[&[u8]] = &[crate::constants::AUTH_SEED, &[auth.burn_mint_auth_bump]];
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

// moved to crate::accounts

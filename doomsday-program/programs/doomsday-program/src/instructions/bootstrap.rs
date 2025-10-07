use crate::constants::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface as token;

pub fn init_global(ctx: Context<crate::InitGlobal>, round_ends_at_unix: i64) -> Result<()> {
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
    g.second_prize_claimed_round = 0;

    ctx.accounts.auth.burn_mint_auth_bump = ctx.bumps.burn_mint_auth;
    ctx.accounts.auth.bump = ctx.bumps.auth;
    Ok(())
}

pub fn set_pause(ctx: Context<crate::SetPause>, paused: bool) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    ctx.accounts.global.paused = paused;
    Ok(())
}

pub fn set_country_pause(ctx: Context<crate::SetCountryPause>, paused: bool) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    ctx.accounts.country.paused = paused;
    Ok(())
}

pub fn init_country(
    ctx: Context<crate::InitCountry>,
    id: u16,
    virtual_sol: u128,
    virtual_token: u128,
) -> Result<()> {
    require!(
        id >= 1 && id <= crate::MAX_COUNTRIES,
        crate::DdError::InvalidAmount
    );
    let g = &mut ctx.accounts.global;
    let c = &mut ctx.accounts.country;
    c.id = id;
    c.status = crate::CountryStatus::Active;
    c.paused = false;
    c.mode = crate::MarketMode::Curve;
    c.curve_frozen = false;

    c.mint = ctx.accounts.mint.key();
    c.token_vault = ctx.accounts.token_vault.key();
    c.sol_treasury = ctx.accounts.sol_treasury.key();

    c.virtual_sol = virtual_sol;
    c.virtual_token = virtual_token;
    c.supply_minted = 0;
    c.supply_burned = 0;
    c.curve_fee_bp = crate::CURVE_FEE_BP_DEFAULT;

    // P0: base price per whole token (lamports)
    c.step_base_price_lamports = 200; // 0.0000002 SOL per token

    // k_e6: slope in *micro-lamports* per token^2 (fixed-point)
    c.curve_slope_per_token_sq_e6 = 10; // 10e-6 lamports/token^2

    // keep these just to encode cumulative units sold; they no longer affect price math
    c.step_tokens = 10_000_000; // 0.01 token worth of units for indexing
    c.current_step_index = 0;
    c.sold_in_current_step = 0;

    c.president = Pubkey::default();
    c.top_holder_cached = 0;

    c.migrate_threshold_usd_e6 = crate::MIGRATE_THRESHOLD_USD_E6_DEFAULT;
    c.raydium_pool_state = Pubkey::default();
    c.raydium_vault_a = Pubkey::default();
    c.raydium_vault_b = Pubkey::default();
    c.raydium_program = Pubkey::default();
    c.migrated_at_ts = 0;

    c.quote_price_q64 = 0;
    c.quote_marketcap = 0;
    c.quote_source = crate::QuoteSource::Unknown;
    c.quote_observed_at = 0;

    c.bump = ctx.bumps.country;
    g.countries_live = g.countries_live.saturating_add(1);

    // Mint fixed max supply (1,000,000,000 tokens with TOKEN_DECIMALS) to the reserve vault.
    let max_supply_raw: u64 =
        MAX_SUPPLY.saturating_mul(10u64.saturating_pow(TOKEN_DECIMALS as u32));
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
    }
    Ok(())
}

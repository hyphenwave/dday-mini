use anchor_lang::prelude::*;

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

    c.step_tokens = 1_000_000;
    c.step_base_price_lamports = 1_000;
    c.step_price_increment_lamports = 1_000;
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
    Ok(())
}

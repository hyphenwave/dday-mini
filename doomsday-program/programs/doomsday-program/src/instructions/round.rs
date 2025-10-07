use crate::events::{PresidentUpdated, RoundEnded};
use crate::*;

pub fn set_president_offchain(
    ctx: Context<crate::SetPresidentOffchain>,
    new_president: Pubkey,
    top_holder_free_balance: u64,
) -> Result<()> {
    require!(
        ctx.accounts.updater.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    let c = &mut ctx.accounts.country;
    require!(
        matches!(c.status, crate::CountryStatus::Active),
        crate::DdError::CountryNuked
    );
    c.president = new_president;
    c.top_holder_cached = top_holder_free_balance;
    emit!(PresidentUpdated {
        country: c.id,
        president: new_president,
        top_holder: top_holder_free_balance
    });
    Ok(())
}

pub fn set_country_quote_offchain(
    ctx: Context<crate::SetCountryQuoteOffchain>,
    price_q64: u128,
    marketcap: u128,
    source: crate::QuoteSource,
    observed_at: i64,
) -> Result<()> {
    require!(
        ctx.accounts.updater.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    let c = &mut ctx.accounts.country;
    c.quote_price_q64 = price_q64;
    c.quote_marketcap = marketcap;
    c.quote_source = source;
    c.quote_observed_at = observed_at;
    Ok(())
}

pub fn end_round(
    ctx: Context<crate::EndRound>,
    winner_country_id: u16,
    next_end_unix: i64,
) -> Result<()> {
    let g = &mut ctx.accounts.global;
    require!(
        ctx.accounts.authority.key() == g.authority,
        crate::DdError::Unauthorized
    );
    require!(
        Clock::get()?.unix_timestamp >= g.round_ends_at_unix,
        crate::DdError::RoundNotEnded
    );
    g.winner_country_id = winner_country_id;
    g.nuke_consumed_for_round = false;
    g.second_prize_claimed_round = 0;
    emit!(RoundEnded {
        round_index: g.round_index,
        winner_country_id
    });
    g.round_index = g.round_index.saturating_add(1);
    g.round_ends_at_unix = next_end_unix;
    Ok(())
}

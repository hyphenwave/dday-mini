use crate::events::{PresidentUpdated, RoundEnded};
use crate::*;

pub fn set_president_offchain(
    ctx: Context<crate::SetPresidentOffchain>,
    new_president: Pubkey,
    top_holder_free_balance: u64,
) -> Result<()> {
    require!(
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.updater.key()),
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
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.updater.key()),
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
        g.authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.authority.key()),
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

/// Transfers the right to launch the nuke (i.e., winner president privilege) to a new president
/// if the current president cannot or does not launch the nuke in time.
/// Gated by authorized updaters; updates only the winner country's president.
pub fn transfer_winner_nuke(
    ctx: Context<crate::TransferWinnerNuke>,
    new_president: Pubkey,
    top_holder_free_balance: u64,
) -> Result<()> {
    // Must be an authorized updater
    require!(
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.updater.key()),
        crate::DdError::Unauthorized
    );
    // Nuke must not have been consumed for this round yet
    require!(
        !ctx.accounts.global.nuke_consumed_for_round,
        crate::DdError::NukeAlreadyUsed
    );
    // Winner country only
    require!(
        ctx.accounts.global.winner_country_id == ctx.accounts.country.id,
        crate::DdError::Unauthorized
    );
    // Winner country should be Active
    require!(
        matches!(ctx.accounts.country.status, crate::CountryStatus::Active),
        crate::DdError::CountryNuked
    );
    // Update president and top holder cache
    let c = &mut ctx.accounts.country;
    c.president = new_president;
    c.top_holder_cached = top_holder_free_balance;
    emit!(PresidentUpdated {
        country: c.id,
        president: new_president,
        top_holder: top_holder_free_balance
    });
    Ok(())
}

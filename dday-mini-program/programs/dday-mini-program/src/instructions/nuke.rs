use anchor_lang::prelude::*;
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;

use crate::*;
use crate::events::NukeLaunched;

pub fn launch_nuke(
    ctx: Context<crate::LaunchNuke>,
    target_country_id: u16,
    random_country_id: u16,
    _raydium_ix_data: Option<Vec<u8>>,
) -> Result<()> {
    let g = &mut ctx.accounts.global;
    require!(!g.paused, crate::DdError::Paused);
    require!(!g.nuke_consumed_for_round, crate::DdError::NukeAlreadyUsed);
    require!(
        g.winner_country_id == ctx.accounts.winner_country.id,
        crate::DdError::NotWinnerPresident
    );
    require!(
        ctx.accounts.winner_country.president == ctx.accounts.president.key(),
        crate::DdError::NotWinnerPresident
    );

    let target = &mut ctx.accounts.target_country;
    require!(matches!(target.status, crate::CountryStatus::Active), crate::DdError::CountryNuked);

    let treasury = &ctx.accounts.target_sol_treasury;
    let sol_rug = (treasury.lamports() as u128 * (crate::NUKE_RUG_BP as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    **treasury.to_account_info().try_borrow_mut_lamports()? -= sol_rug;

    let buyback = sol_rug / 2;
    let to_random = sol_rug - buyback;

    let mut burned: u64 = 0;
    if matches!(ctx.accounts.winner_country.mode, crate::MarketMode::Amm) {
        if let Some(data) = _raydium_ix_data {
            require!(
                crate::accounts_contains(
                    ctx.remaining_accounts,
                    &ctx.accounts.winner_country.raydium_pool_state
                ),
                crate::DdError::Unauthorized
            );
            require!(
                crate::accounts_contains(
                    ctx.remaining_accounts,
                    &ctx.accounts.winner_country.raydium_vault_a
                ),
                crate::DdError::Unauthorized
            );
            require!(
                crate::accounts_contains(
                    ctx.remaining_accounts,
                    &ctx.accounts.winner_country.raydium_vault_b
                ),
                crate::DdError::Unauthorized
            );

            let before = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
            let signer_seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            crate::cpi_raydium_swap(
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
        burned = crate::internal_buy_and_burn(
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
    **ctx
        .accounts
        .random_country_sol_treasury
        .to_account_info()
        .try_borrow_mut_lamports()? += to_random;

    target.status = crate::CountryStatus::Nuked;
    g.nuke_consumed_for_round = true;
    g.countries_live = g.countries_live.saturating_sub(1);

    emit!(NukeLaunched {
        round_index: g.round_index,
        winner_country_id: ctx.accounts.winner_country.id,
        target_country_id,
        sol_rugged: sol_rug,
        to_buyback: buyback,
        to_random,
    });
    Ok(())
}

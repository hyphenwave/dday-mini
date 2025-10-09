use crate::events::SecondPrizeExecuted;
use anchor_lang::prelude::*;
use anchor_spl::token::{self as spl_token, accessor};
use anchor_spl::token_interface as token;

pub fn execute_second_prize(
    ctx: Context<crate::ExecuteSecondPrize>,
    _raydium_ix_data: Option<Vec<u8>>,
) -> Result<()> {
    let g = &mut ctx.accounts.global;
    require!(!g.paused, crate::DdError::Paused);
    require!(
        g.winner_country_id == ctx.accounts.winner_country.id,
        crate::DdError::Unauthorized
    );
    require!(
        g.second_prize_claimed_round != g.round_index,
        crate::DdError::Unauthorized
    );
    let pot = g.prize_pot_lamports;
    require!(pot > 0, crate::DdError::InvalidAmount);

    **ctx
        .accounts
        .global_account
        .to_account_info()
        .try_borrow_mut_lamports()? -= pot;
    g.prize_pot_lamports = 0;
    g.second_prize_claimed_round = g.round_index;

    let mut burned: u64 = 0;
    if matches!(ctx.accounts.winner_country.mode, crate::MarketMode::Amm) {
        if let Some(data) = _raydium_ix_data {
            // Wrap pot lamports into PDA-owned WSOL ATA
            **ctx
                .accounts
                .wsol_ata
                .to_account_info()
                .try_borrow_mut_lamports()? += pot;
            // SyncNative so WSOL amount reflects lamports
            spl_token::sync_native(CpiContext::new(
                ctx.accounts.token_program_classic.to_account_info(),
                spl_token::SyncNative {
                    account: ctx.accounts.wsol_ata.to_account_info(),
                },
            ))?;
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
            let signer_seeds: &[&[u8]] =
                &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
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
    } else {
        burned = crate::internal_buy_and_burn(
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
        tokens_burned: burned,
        mode: ctx.accounts.winner_country.mode,
    });
    Ok(())
}

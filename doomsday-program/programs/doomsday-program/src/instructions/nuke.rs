use crate::events::{NukeLaunched, NukeLaunchedIndexed};
use anchor_lang::prelude::*;
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;

pub fn launch_nuke(
    ctx: Context<crate::LaunchNuke>,
    target_country_id: u16,
    random_country_id: u16,
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

    // If any participant requires AMM actions, defer to off-chain executor via event only
    let requires_amm = matches!(ctx.accounts.winner_country.mode, crate::MarketMode::Amm)
        || matches!(ctx.accounts.target_country.mode, crate::MarketMode::Amm)
        || matches!(ctx.accounts.random_country.mode, crate::MarketMode::Amm);

    emit!(NukeLaunchedIndexed {
        round_index: g.round_index,
        winner_country_id: ctx.accounts.winner_country.id,
        target_country_id,
        random_country_id,
    });

    if requires_amm {
        // Defer execution; indexer will call execute_nuke with Raydium CPI metas
        return Ok(());
    }

    // Curve-only inline execution
    let target = &mut ctx.accounts.target_country;
    require!(
        matches!(target.status, crate::CountryStatus::Active),
        crate::DdError::CountryNuked
    );
    let treasury = &ctx.accounts.target_sol_treasury;
    let sol_rug = (treasury.lamports() as u128 * (crate::NUKE_RUG_BP as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    **treasury.to_account_info().try_borrow_mut_lamports()? -= sol_rug;

    let buyback = sol_rug / 2;
    let to_random = sol_rug - buyback;

    let burned_winner = crate::internal_buy_and_burn(
        &ctx.accounts.token_program,
        &ctx.accounts.winner_mint,
        &ctx.accounts.winner_token_vault,
        &ctx.accounts.winner_sol_treasury,
        &ctx.accounts.burn_mint_auth,
        &ctx.accounts.auth,
        &mut ctx.accounts.winner_country,
        buyback,
    )?;

    let burned_random = crate::internal_buy_and_burn(
        &ctx.accounts.token_program,
        &ctx.accounts.random_mint,
        &ctx.accounts.random_token_vault,
        &ctx.accounts.random_country_sol_treasury,
        &ctx.accounts.burn_mint_auth,
        &ctx.accounts.auth,
        &mut ctx.accounts.random_country,
        to_random,
    )?;

    target.status = crate::CountryStatus::Nuked;
    g.nuke_consumed_for_round = true;
    g.countries_live = g.countries_live.saturating_sub(1);
    emit!(NukeLaunched {
        round_index: g.round_index,
        winner_country_id: ctx.accounts.winner_country.id,
        target_country_id,
        random_country_id,
        sol_pulled: sol_rug,
        to_winner_buyback: buyback,
        to_random_buyback: to_random,
        winner_tokens_burned: burned_winner,
        random_tokens_burned: burned_random,
    });
    Ok(())
}

pub fn execute_nuke(
    ctx: Context<crate::ExecuteNuke>,
    target_country_id: u16,
    random_country_id: u16,
    raydium_withdraw_ix_data: Option<Vec<u8>>, // for target liquidity pull
    winner_swap_ix_data: Option<Vec<u8>>,      // for winner buyback
    random_swap_ix_data: Option<Vec<u8>>,      // for random buyback
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

    // 1) Pull target liquidity
    let mut sol_pulled: u64 = 0;
    if matches!(ctx.accounts.target_country.mode, crate::MarketMode::Amm) {
        if let Some(ix) = raydium_withdraw_ix_data {
            let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            // CPI Raydium withdraw: remaining accounts must route WSOL to wsol_ata and tokens to target vault
            let metas = ctx.remaining_accounts;
            let ix_struct = anchor_lang::solana_program::instruction::Instruction {
                program_id: ctx.accounts.raydium_program.key(),
                accounts: metas
                    .iter()
                    .map(|ai| anchor_lang::solana_program::instruction::AccountMeta {
                        pubkey: ai.key(),
                        is_signer: if ai.key() == ctx.accounts.burn_mint_auth.key() {
                            true
                        } else {
                            ai.is_signer
                        },
                        is_writable: ai.is_writable,
                    })
                    .collect(),
                data: ix,
            };
            anchor_lang::solana_program::program::invoke_signed(&ix_struct, metas, &[seeds])?;
            // unwrap WSOL to SOL into target treasury
            let wsol_amt =
                anchor_spl::token::accessor::amount(&ctx.accounts.wsol_ata.to_account_info())?;
            if wsol_amt > 0 {
                anchor_spl::token::close_account(CpiContext::new_with_signer(
                    ctx.accounts.token_program_classic.to_account_info(),
                    anchor_spl::token::CloseAccount {
                        account: ctx.accounts.wsol_ata.to_account_info(),
                        destination: ctx.accounts.target_sol_treasury.to_account_info(),
                        authority: ctx.accounts.burn_mint_auth.to_account_info(),
                    },
                    &[seeds],
                ))?;
                sol_pulled = sol_pulled.saturating_add(wsol_amt);
            }
        }
    } else {
        // Curve: rug portion from target treasury directly
        let treasury = &ctx.accounts.target_sol_treasury;
        let sol_rug = (treasury.lamports() as u128 * (crate::NUKE_RUG_BP as u128)
            / (crate::BASIS_POINTS as u128)) as u64;
        **treasury.to_account_info().try_borrow_mut_lamports()? -= sol_rug;
        sol_pulled = sol_rug;
    }

    // Split 50/50
    let to_winner = sol_pulled / 2;
    let to_random = sol_pulled - to_winner;

    // 2) Winner buyback & burn
    let mut burned_winner = 0u64;
    if matches!(ctx.accounts.winner_country.mode, crate::MarketMode::Amm) {
        if let Some(ix) = winner_swap_ix_data {
            // Move SOL budget to WSOL ATA and sync (SOL -> WSOL)
            **ctx
                .accounts
                .target_sol_treasury
                .to_account_info()
                .try_borrow_mut_lamports()? -= to_winner;
            **ctx
                .accounts
                .wsol_ata
                .to_account_info()
                .try_borrow_mut_lamports()? += to_winner;
            anchor_spl::token::sync_native(CpiContext::new(
                ctx.accounts.token_program_classic.to_account_info(),
                anchor_spl::token::SyncNative {
                    account: ctx.accounts.wsol_ata.to_account_info(),
                },
            ))?;

            let before = accessor::amount(&ctx.accounts.winner_token_vault.to_account_info())?;
            let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            crate::cpi_raydium_swap(
                ctx.accounts.winner_country.raydium_program,
                ctx.remaining_accounts,
                seeds,
                ix,
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
                        &[seeds],
                    ),
                    delta,
                )?;
                ctx.accounts.winner_country.supply_burned = ctx
                    .accounts
                    .winner_country
                    .supply_burned
                    .saturating_add(delta);
                burned_winner = burned_winner.saturating_add(delta);
            }
        }
    } else if to_winner > 0 {
        burned_winner = burned_winner.saturating_add(crate::internal_buy_and_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.winner_mint,
            &ctx.accounts.winner_token_vault,
            &ctx.accounts.winner_sol_treasury,
            &ctx.accounts.burn_mint_auth,
            &ctx.accounts.auth,
            &mut ctx.accounts.winner_country,
            to_winner,
        )?);
    }
    let mut burned_random = 0u64;

    // 3) Random buyback & burn
    if matches!(ctx.accounts.random_country.mode, crate::MarketMode::Amm) {
        if let Some(ix) = random_swap_ix_data {
            // Move SOL budget to WSOL ATA and sync (SOL -> WSOL)
            **ctx
                .accounts
                .target_sol_treasury
                .to_account_info()
                .try_borrow_mut_lamports()? -= to_random;
            **ctx
                .accounts
                .wsol_ata
                .to_account_info()
                .try_borrow_mut_lamports()? += to_random;
            anchor_spl::token::sync_native(CpiContext::new(
                ctx.accounts.token_program_classic.to_account_info(),
                anchor_spl::token::SyncNative {
                    account: ctx.accounts.wsol_ata.to_account_info(),
                },
            ))?;

            let before = accessor::amount(&ctx.accounts.random_token_vault.to_account_info())?;
            let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
            crate::cpi_raydium_swap(
                ctx.accounts.random_country.raydium_program,
                ctx.remaining_accounts,
                seeds,
                ix,
            )?;
            let after = accessor::amount(&ctx.accounts.random_token_vault.to_account_info())?;
            let delta = after.saturating_sub(before);
            if delta > 0 {
                token::burn(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token::Burn {
                            mint: ctx.accounts.random_mint.to_account_info(),
                            from: ctx.accounts.random_token_vault.to_account_info(),
                            authority: ctx.accounts.burn_mint_auth.to_account_info(),
                        },
                        &[seeds],
                    ),
                    delta,
                )?;
                ctx.accounts.random_country.supply_burned = ctx
                    .accounts
                    .random_country
                    .supply_burned
                    .saturating_add(delta);
                burned_random = burned_random.saturating_add(delta);
            }
        }
    } else if to_random > 0 {
        burned_random = burned_random.saturating_add(crate::internal_buy_and_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.random_mint,
            &ctx.accounts.random_token_vault,
            &ctx.accounts.random_country_sol_treasury,
            &ctx.accounts.burn_mint_auth,
            &ctx.accounts.auth,
            &mut ctx.accounts.random_country,
            to_random,
        )?);
    }

    ctx.accounts.target_country.status = crate::CountryStatus::Nuked;
    g.nuke_consumed_for_round = true;
    g.countries_live = g.countries_live.saturating_sub(1);
    emit!(NukeLaunched {
        round_index: g.round_index,
        winner_country_id: ctx.accounts.winner_country.id,
        target_country_id,
        random_country_id,
        sol_pulled: sol_pulled,
        to_winner_buyback: to_winner,
        to_random_buyback: to_random,
        winner_tokens_burned: burned_winner,
        random_tokens_burned: burned_random,
    });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;

use crate::events::{BoughtOnCurve, SoldOnCurve};
use crate::*;

pub fn buy_on_curve(
    ctx: Context<crate::BuyOnCurve>,
    min_tokens_out: u64,
    sol_in: u64,
) -> Result<()> {
    require!(!ctx.accounts.global.paused, crate::DdError::Paused);
    require!(!ctx.accounts.country.paused, crate::DdError::Paused);
    require!(
        matches!(ctx.accounts.country.status, crate::CountryStatus::Active),
        crate::DdError::CountryNuked
    );
    require!(
        matches!(ctx.accounts.country.mode, crate::MarketMode::Curve)
            && !ctx.accounts.country.curve_frozen,
        crate::DdError::WrongMode
    );
    require!(sol_in > 0, crate::DdError::InvalidAmount);

    let payer = &ctx.accounts.payer;
    let treasury = &ctx.accounts.sol_treasury;
    **payer.to_account_info().try_borrow_mut_lamports()? -= sol_in;
    **treasury.to_account_info().try_borrow_mut_lamports()? += sol_in;

    let global_tax =
        (sol_in as u128 * (crate::GLOBAL_TAX_BP as u128) / (crate::BASIS_POINTS as u128)) as u64;
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

    let mut tokens_remaining_to_sell = min_tokens_out;
    let protocol_fee = (((sol_in - global_tax) as u128)
        * (ctx.accounts.country.curve_fee_bp as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    let mut sol_budget = (sol_in - global_tax).saturating_sub(protocol_fee) as u64;
    if protocol_fee > 0 {
        **treasury.to_account_info().try_borrow_mut_lamports()? -= protocol_fee;
        **ctx
            .accounts
            .protocol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += protocol_fee;
    }
    let mut tokens_to_send: u64 = 0;

    let mut vault_amount = accessor::amount(&ctx.accounts.token_vault.to_account_info())?;
    require!(vault_amount > 0, crate::DdError::InvalidAmount);

    while tokens_remaining_to_sell > 0 && sol_budget > 0 && vault_amount > 0 {
        let step_size = ctx.accounts.country.step_tokens;
        let step_sold = ctx.accounts.country.sold_in_current_step;
        let remaining_in_step = step_size.saturating_sub(step_sold);
        if remaining_in_step == 0 {
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

    require!(tokens_to_send >= min_tokens_out, crate::DdError::Slippage);

    let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
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
        crate::TOKEN_DECIMALS,
    )?;

    let round_index = ctx.accounts.global.round_index;
    let country_id = ctx.accounts.country.id;
    emit!(BoughtOnCurve {
        round: round_index,
        country: country_id,
        buyer: ctx.accounts.payer.key(),
        sol_in,
        tokens_out: tokens_to_send,
        price_bp: 0,
    });
    Ok(())
}

pub fn sell_on_curve(
    ctx: Context<crate::SellOnCurve>,
    min_sol_out: u64,
    tokens_in: u64,
) -> Result<()> {
    require!(!ctx.accounts.global.paused, crate::DdError::Paused);
    require!(!ctx.accounts.country.paused, crate::DdError::Paused);
    require!(
        matches!(ctx.accounts.country.status, crate::CountryStatus::Active),
        crate::DdError::CountryNuked
    );
    require!(
        matches!(ctx.accounts.country.mode, crate::MarketMode::Curve)
            && !ctx.accounts.country.curve_frozen,
        crate::DdError::WrongMode
    );
    require!(tokens_in > 0, crate::DdError::InvalidAmount);

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
        crate::TOKEN_DECIMALS,
    )?;

    let mut tokens_remaining = tokens_in;
    let mut sol_out_u64: u64 = 0;
    while tokens_remaining > 0 {
        let step_sold = ctx.accounts.country.sold_in_current_step;
        let consumed_in_step = step_sold.min(ctx.accounts.country.step_tokens);
        if consumed_in_step == 0 {
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
        crate::DdError::Slippage
    );

    let protocol_fee = (sol_out_u64 as u128 * (ctx.accounts.country.curve_fee_bp as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    let global_tax = (sol_out_u64 as u128 * (crate::GLOBAL_TAX_BP as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    let seller_amount = sol_out_u64
        .saturating_sub(protocol_fee)
        .saturating_sub(global_tax);

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

    if protocol_fee > 0 {
        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= protocol_fee;
        **ctx
            .accounts
            .protocol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += protocol_fee;
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
        price_bp: 0,
    });
    Ok(())
}

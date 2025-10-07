use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;

use crate::events::{BoughtOnCurve, SoldOnCurve};
use crate::utils::{ceil_div_u128, floor_div_u128, fold_units, unfold_units};

pub fn buy_on_curve(
    ctx: Context<crate::BuyOnCurve>,
    min_tokens_out: u64, // in base units (10^-decimals)
    sol_in: u64,         // lamports sent in
) -> Result<()> {
    // ---- Gates ----
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

    // ---- user -> treasury ----
    let payer = &ctx.accounts.payer;
    let treasury = &ctx.accounts.sol_treasury;
    invoke(
        &system_instruction::transfer(&payer.key(), &treasury.key(), sol_in),
        &[payer.to_account_info(), treasury.to_account_info()],
    )?;

    // ---- fees/tax ----
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

    let protocol_fee = (((sol_in - global_tax) as u128)
        * (ctx.accounts.country.curve_fee_bp as u128)
        / (crate::BASIS_POINTS as u128)) as u64;
    if protocol_fee > 0 {
        **treasury.to_account_info().try_borrow_mut_lamports()? -= protocol_fee;
        **ctx
            .accounts
            .protocol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += protocol_fee;
    }

    // remaining budget for *trading* on the curve
    let mut budget: u64 = sol_in
        .saturating_sub(global_tax)
        .saturating_sub(protocol_fee);

    // ---- inventory ----
    let mut vault_amount: u64 = accessor::amount(&ctx.accounts.token_vault.to_account_info())?;
    require!(vault_amount > 0, crate::DdError::InvalidAmount);

    // ---- curve params ----
    // P0 in lamports/token ; k_e6 in micro-lamports/token^2
    let p0: u128 = ctx.accounts.country.step_base_price_lamports as u128;
    let k_e6: u128 = ctx.accounts.country.curve_slope_per_token_sq_e6 as u128; // repurposed as slope_e6
    let micro: u128 = 1_000_000u128;

    let scale: u128 = 10u128.pow(crate::TOKEN_DECIMALS as u32); // base units per token
    let denom: u128 = scale.saturating_mul(scale).saturating_mul(micro); // 10^(2d)*1e6

    let c = &mut ctx.accounts.country;
    let step_units: u64 = c.step_tokens.max(1);
    let mut u_units: u128 = fold_units(c.current_step_index, c.sold_in_current_step, step_units);

    // Cost(u, q_units) with ceil, *in lamports*
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
        // num = 2*P0*q*scale*1e6 + 2*k_e6*u*q + k_e6*q*q
        let term_base = (p0.saturating_mul(q_units).saturating_mul(scale))
            .saturating_mul(2)
            .saturating_mul(1_000_000);
        let term_lin = (k_e6.saturating_mul(u_units).saturating_mul(q_units)).saturating_mul(2);
        let term_quad = k_e6.saturating_mul(q_units).saturating_mul(q_units);
        let num = term_base.saturating_add(term_lin).saturating_add(term_quad);
        let den = denom.saturating_mul(2); // 2*scale^2*1e6
        ceil_div_u128(num, den)
    }

    // Binary-search q_units (≤ vault_amount) so that cost ≤ budget
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
        let q_units = lo as u64;
        require!(q_units > 0, crate::DdError::Slippage);

        let spent =
            cost_lamports(u_units, lo, p0, k_e6, scale, denom).min(u128::from(u64::MAX)) as u64;
        budget = budget.saturating_sub(spent);

        // inventory + state
        let bought = q_units.min(vault_amount);
        vault_amount = vault_amount.saturating_sub(bought);

        // slippage
        require!(bought >= min_tokens_out, crate::DdError::Slippage);

        // transfer tokens reserve -> buyer (AUTH signs)
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
            bought,
            crate::TOKEN_DECIMALS,
        )?;

        // advance u
        u_units = u_units.saturating_add(bought as u128);
        let (idx, rem) = unfold_units(u_units, step_units);
        c.current_step_index = idx;
        c.sold_in_current_step = rem;

        emit!(BoughtOnCurve {
            round: ctx.accounts.global.round_index,
            country: c.id,
            buyer: ctx.accounts.payer.key(),
            sol_in,
            tokens_out: bought,
            price_bp: 0, // optionally compute realized avg → (spent * 10_000 / (bought * ?)), if you want
        });
    } else {
        // no budget/inventory → just enforce slippage = 0
        require!(0 >= min_tokens_out, crate::DdError::Slippage);
    }

    Ok(())
}

pub fn sell_on_curve(
    ctx: Context<crate::SellOnCurve>,
    min_sol_out: u64, // lamports the seller expects at least
    tokens_in: u64,   // base units (10^-decimals) sent to sell
) -> Result<()> {
    // ---- Gates ----
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

    // Move seller tokens -> reserve vault (we'll refund any unsold below)
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

    // ---- Curve params (continuous) ----
    // P0 in lamports/token ; k_e6 in micro-lamports/token^2
    let p0: u128 = ctx.accounts.country.step_base_price_lamports as u128;
    let k_e6: u128 = ctx.accounts.country.curve_slope_per_token_sq_e6 as u128; // slope (fixed-point, micro-lamports)
    let micro: u128 = 1_000_000u128;

    let scale: u128 = 10u128.pow(crate::TOKEN_DECIMALS as u32); // base units per whole token
    let denom: u128 = scale.saturating_mul(scale).saturating_mul(micro); // 10^(2*decimals)*1e6

    let c = &mut ctx.accounts.country;
    let step_units: u64 = c.step_tokens.max(1);
    let mut u_units: u128 = fold_units(c.current_step_index, c.sold_in_current_step, step_units);

    // Cannot sell more units than have ever been "sold" onto the curve
    let max_by_curve: u128 = core::cmp::min(tokens_in as u128, u_units);

    // If nothing to unwind on the curve, refund immediately
    if max_by_curve == 0 {
        // refund full amount back to seller (AUTH PDA signs)
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            tokens_in,
            crate::TOKEN_DECIMALS,
        )?;
        return err!(crate::DdError::InvalidAmount);
    }

    // ---- Revenue integral with FLOOR rounding ----
    #[inline(always)]
    fn revenue_lamports(
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
        // num = 2*P0*q*scale*1e6 + 2*k_e6*u*q - k_e6*q*q
        let term_base = (p0.saturating_mul(q_units).saturating_mul(scale))
            .saturating_mul(2)
            .saturating_mul(1_000_000);
        let term_lin = (k_e6.saturating_mul(u_units).saturating_mul(q_units)).saturating_mul(2);
        let term_quad = k_e6.saturating_mul(q_units).saturating_mul(q_units);
        let num = term_base.saturating_add(term_lin).saturating_sub(term_quad);
        let den = denom.saturating_mul(2);
        floor_div_u128(num, den) // FLOOR on sell to avoid overpaying from rounding
    }

    // Solvency-aware fill: find max q such that gross ≤ treasury
    let treasury_lamports = ctx.accounts.sol_treasury.lamports() as u128;

    let mut lo: u128 = 0;
    let mut hi: u128 = max_by_curve;
    if treasury_lamports > 0 {
        while lo < hi {
            let mid = lo + (hi - lo + 1) / 2;
            let gross = revenue_lamports(u_units, mid, p0, k_e6, scale, denom);
            if gross <= treasury_lamports {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
    }
    let q_units = lo as u64;
    require!(q_units > 0, crate::DdError::Slippage);

    // Compute gross, fees, payout (all u64)
    let gross =
        revenue_lamports(u_units, lo, p0, k_e6, scale, denom).min(u128::from(u64::MAX)) as u64;

    // Floor the fees/tax out of gross (conservative)
    let protocol_fee =
        (gross as u128 * (c.curve_fee_bp as u128) / (crate::BASIS_POINTS as u128)) as u64;
    let global_tax =
        (gross as u128 * (crate::GLOBAL_TAX_BP as u128) / (crate::BASIS_POINTS as u128)) as u64;
    let seller_amt = gross
        .saturating_sub(protocol_fee)
        .saturating_sub(global_tax);

    require!(
        seller_amt >= min_sol_out && seller_amt > 0,
        crate::DdError::Slippage
    );
    require!(
        ctx.accounts.sol_treasury.lamports() >= gross,
        crate::DdError::InsufficientLiquidity
    );

    // Pay out (gross → split)
    if global_tax > 0 {
        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= global_tax;
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
        .try_borrow_mut_lamports()? -= seller_amt;
    **ctx
        .accounts
        .seller
        .to_account_info()
        .try_borrow_mut_lamports()? += seller_amt;

    // If we transferred more tokens than could be sold, refund the remainder
    if q_units < tokens_in {
        let refund_units = tokens_in.saturating_sub(q_units);
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            refund_units,
            crate::TOKEN_DECIMALS,
        )?;
    }

    // Update curve state: we moved *down* by q_units
    u_units = u_units.saturating_sub(q_units as u128);
    let (idx, rem) = unfold_units(u_units, step_units);
    c.current_step_index = idx;
    c.sold_in_current_step = rem;

    emit!(SoldOnCurve {
        round: ctx.accounts.global.round_index,
        country: c.id,
        seller: ctx.accounts.seller.key(),
        tokens_in: q_units,
        sol_out: gross, // gross before fees; UI can show net = seller_amt
        price_bp: 0,
    });

    Ok(())
}

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::accessor;
use anchor_spl::token_interface as token;

use crate::*;
use crate::events::{CurveFrozen, MigratedToAmm};

pub fn freeze_curve(ctx: Context<crate::FreezeCurve>) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    let c = &mut ctx.accounts.country;
    require!(
        matches!(c.mode, crate::MarketMode::Curve),
        crate::DdError::WrongMode
    );
    // Flip the freeze flag; callable once
    c.curve_frozen = true;
    emit!(CurveFrozen { country: c.id });
    Ok(())
}

pub fn seed_raydium_pool(
    ctx: Context<crate::SeedRaydiumPool>,
    raydium_program: Pubkey,
    pool_state: Pubkey,
    raydium_vault_a: Pubkey,
    raydium_vault_b: Pubkey,
    raydium_ix_data: Vec<u8>,
) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    let c = &mut ctx.accounts.country;
    require!(
        matches!(c.mode, crate::MarketMode::Curve),
        crate::DdError::WrongMode
    );
    require!(c.curve_frozen, crate::DdError::CurveNotFrozen);

    let available_sol = ctx.accounts.sol_treasury.lamports();
    if available_sol > 0 {
        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= available_sol;
        **ctx
            .accounts
            .burn_mint_auth
            .to_account_info()
            .try_borrow_mut_lamports()? += available_sol;
    }

    let token_seed_amount = accessor::amount(&ctx.accounts.token_vault.to_account_info())?;
    if token_seed_amount > 0 {
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.liquidity_token_account.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            token_seed_amount,
            crate::TOKEN_DECIMALS,
        )?;
    }

    if !raydium_ix_data.is_empty() {
        let metas: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|ai| {
                let mut is_signer = ai.is_signer;
                if ai.key == ctx.accounts.burn_mint_auth.key {
                    is_signer = true;
                }
                AccountMeta {
                    pubkey: *ai.key,
                    is_signer,
                    is_writable: ai.is_writable,
                }
            })
            .collect();
        let ix = Instruction {
            program_id: raydium_program,
            accounts: metas,
            data: raydium_ix_data,
        };
        let signer_seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        invoke_signed(&ix, ctx.remaining_accounts, &[signer_seeds])?;
    }

    c.raydium_program = raydium_program;
    c.raydium_pool_state = pool_state;
    c.raydium_vault_a = raydium_vault_a;
    c.raydium_vault_b = raydium_vault_b;
    c.mode = crate::MarketMode::Amm;
    c.migrated_at_ts = Clock::get()?.unix_timestamp;
    emit!(MigratedToAmm {
        country: c.id,
        pool_state,
        at: c.migrated_at_ts,
    });
    Ok(())
}

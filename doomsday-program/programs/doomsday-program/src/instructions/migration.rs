use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{self as spl_token};
use anchor_spl::token_interface as token2022;

use crate::events::{CurveFrozen, MigratedToAmm};
use crate::state::*;
use crate::{dd_accounts::*, DdError};

pub fn freeze_curve(ctx: Context<crate::FreezeCurve>) -> Result<()> {
    require!(
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.authority.key()),
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
    ctx: Context<SeedRaydiumPool>,
    raydium_program: Pubkey,
    // Raydium pool metadata you want to persist
    pool_state: Pubkey,
    raydium_vault_a: Pubkey, // Raydium token vault (country mint side)
    raydium_vault_b: Pubkey, // Raydium quote vault (WSOL side)
    lp_mint: Pubkey,         // Raydium LP mint
    // How much to seed from on-chain reserves (these will be *used* by Raydium CPIs)
    sol_seed_lamports: u64,
    token_seed_amount: u64,
    // Raydium CPIs (same remaining_accounts slice must include all accounts for both calls)
    create_ix_data: Vec<u8>,  // Raydium create-pool ix data
    deposit_ix_data: Vec<u8>, // Raydium add-liquidity ix data
) -> Result<()> {
    // --- auth & mode ---
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        DdError::Unauthorized
    );
    let c = &mut ctx.accounts.country;
    require!(matches!(c.mode, MarketMode::Curve), DdError::WrongMode);
    require!(c.curve_frozen, DdError::CurveNotFrozen);

    // --- 1) Prepare token side (Token-2022) ---
    // Move country tokens from PDA vault to *remain there*. Raydium deposit will debit from this PDA-owned ATA.
    // If you keep tokens already in token_vault, you don't need to move them elsewhere.
    // Optionally ensure we have at least `token_seed_amount` available (not enforced here).
    if token_seed_amount > 0 {
        // (No move needed if your Raydium deposit will read from token_vault directly with owner=AUTH PDA)
        // If you *must* top up, mint to vault:
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        token2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program_2022.to_account_info(),
                token2022::MintTo {
                    mint: ctx.accounts.country_mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.burn_mint_auth.to_account_info(),
                },
                &[seeds],
            ),
            token_seed_amount, // if you need to mint for seeding; else remove this block
        )?;
        c.supply_minted = c.supply_minted.saturating_add(token_seed_amount);
    }

    // --- 2) Wrap SOL → WSOL in PDA-owned ATA (classic SPL) ---
    if sol_seed_lamports > 0 {
        // transfer lamports from treasury to PDA-owned WSOL ATA
        **ctx
            .accounts
            .sol_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= sol_seed_lamports;
        **ctx
            .accounts
            .wsol_ata
            .to_account_info()
            .try_borrow_mut_lamports()? += sol_seed_lamports;
        // sync native to set WSOL amount
        spl_token::sync_native(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            spl_token::SyncNative {
                account: ctx.accounts.wsol_ata.to_account_info(),
            },
        ))?;
    }

    // --- 3) CPI #1: Raydium create pool ---
    // Note: pool fee recipient should be configured to PROTOCOL_TREASURY_SEED PDA by the SDK when building ix
    {
        let ix = Instruction {
            program_id: raydium_program,
            accounts: ctx
                .remaining_accounts
                .iter()
                .map(|ai| {
                    // Let AUTH PDA sign where expected
                    let mut is_signer = ai.is_signer;
                    if ai.key() == ctx.accounts.burn_mint_auth.key() {
                        is_signer = true;
                    }
                    anchor_lang::solana_program::instruction::AccountMeta {
                        pubkey: ai.key(),
                        is_signer,
                        is_writable: ai.is_writable,
                    }
                })
                .collect(),
            data: create_ix_data,
        };
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        invoke_signed(&ix, &ctx.remaining_accounts, &[seeds])?;
    }

    // --- 4) CPI #2: Raydium add liquidity (deposit) ---
    {
        let ix = Instruction {
            program_id: raydium_program,
            accounts: ctx
                .remaining_accounts
                .iter()
                .map(|ai| {
                    let mut is_signer = ai.is_signer;
                    if ai.key() == ctx.accounts.burn_mint_auth.key() {
                        is_signer = true;
                    }
                    anchor_lang::solana_program::instruction::AccountMeta {
                        pubkey: ai.key(),
                        is_signer,
                        is_writable: ai.is_writable,
                    }
                })
                .collect(),
            data: deposit_ix_data,
        };
        let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
        invoke_signed(&ix, &ctx.remaining_accounts, &[seeds])?;
    }

    // --- 5) Persist Raydium custody (program-owned LP) ---
    // Validate LP ATA belongs to AUTH PDA & has correct mint
    {
        let ata_owner = ctx.accounts.lp_owner_lp_ata_acc.owner;
        let ata_mint = ctx.accounts.lp_owner_lp_ata_acc.mint;
        require!(
            ata_owner == ctx.accounts.burn_mint_auth.key(),
            DdError::Unauthorized
        );
        require!(ata_mint == lp_mint, DdError::Unauthorized);
    }

    c.raydium_program = raydium_program;
    c.raydium_pool_state = pool_state;
    c.raydium_vault_a = raydium_vault_a;
    c.raydium_vault_b = raydium_vault_b;
    c.raydium_lp_mint = lp_mint;
    c.raydium_lp_vault = ctx.accounts.lp_owner_lp_ata_acc.key();

    c.mode = MarketMode::Amm;
    c.curve_frozen = false;
    c.migrated_at_ts = Clock::get()?.unix_timestamp;
    emit!(MigratedToAmm {
        country: c.id,
        pool_state,
        at: c.migrated_at_ts
    });
    Ok(())
}

use crate::dd_accounts::RemoveRaydiumLiquidityViaProgram;

pub fn remove_raydium_liquidity_via_program(
    ctx: Context<RemoveRaydiumLiquidityViaProgram>,
    withdraw_ix_data: Vec<u8>,
) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.global.authority,
        crate::DdError::Unauthorized
    );
    let c = &ctx.accounts.country;
    require!(
        matches!(c.mode, crate::MarketMode::Amm),
        crate::DdError::WrongMode
    );

    // Enforce LP ATA ownership & identity
    require!(
        ctx.accounts.lp_owner_lp_ata.key() == c.raydium_lp_vault,
        crate::DdError::Unauthorized
    );
    require!(
        ctx.accounts.lp_owner_lp_ata.owner == ctx.accounts.burn_mint_auth.key(),
        crate::DdError::Unauthorized
    );

    // Sanity: Raydium pool & vaults are present
    require!(
        crate::accounts_contains(ctx.remaining_accounts, &c.raydium_pool_state),
        crate::DdError::Unauthorized
    );
    require!(
        crate::accounts_contains(ctx.remaining_accounts, &c.raydium_vault_a),
        crate::DdError::Unauthorized
    );
    require!(
        crate::accounts_contains(ctx.remaining_accounts, &c.raydium_vault_b),
        crate::DdError::Unauthorized
    );

    // Sanity: withdraw destinations must be our vaults
    require!(
        crate::accounts_contains(ctx.remaining_accounts, &ctx.accounts.token_vault.key()),
        crate::DdError::Unauthorized
    );
    require!(
        crate::accounts_contains(ctx.remaining_accounts, &ctx.accounts.wsol_ata.key()),
        crate::DdError::Unauthorized
    );

    // CPI to Raydium (withdraw)
    let seeds: &[&[u8]] = &[crate::AUTH_SEED, &[ctx.accounts.auth.burn_mint_auth_bump]];
    let ix = Instruction {
        program_id: ctx.accounts.raydium_program.key(),
        accounts: ctx
            .remaining_accounts
            .iter()
            .map(|ai| {
                // Let AUTH PDA sign where required by Raydium
                let mut is_signer = ai.is_signer;
                if ai.key() == ctx.accounts.burn_mint_auth.key() {
                    is_signer = true;
                }
                anchor_lang::solana_program::instruction::AccountMeta {
                    pubkey: ai.key(),
                    is_signer,
                    is_writable: ai.is_writable,
                }
            })
            .collect(),
        data: withdraw_ix_data,
    };
    invoke_signed(&ix, &ctx.remaining_accounts, &[seeds])?;

    // === WSOL → SOL: close the ATA to the SOL treasury
    // (keeps accounts tidy and ensures country Treasury ends up with native SOL)
    let wsol_amt = spl_token::accessor::amount(&ctx.accounts.wsol_ata.to_account_info())?;
    if wsol_amt > 0 {
        spl_token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            spl_token::CloseAccount {
                account: ctx.accounts.wsol_ata.to_account_info(),
                destination: ctx.accounts.sol_treasury.to_account_info(),
                authority: ctx.accounts.burn_mint_auth.to_account_info(),
            },
            &[seeds],
        ))?;
    }

    Ok(())
}

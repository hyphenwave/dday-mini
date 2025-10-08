use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

use crate::*;

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    // Extra space to accommodate authorized_updaters Vec<Pubkey>
    #[account(init, payer=authority, space=8 + 1024, seeds=[GLOBAL_SEED], bump)]
    pub global: Account<'info, Global>,

    /// CHECK: global protocol treasury PDA (lamports holder)
    #[account(init, payer=authority, space=0, seeds=[PROTOCOL_TREASURY_SEED], bump)]
    pub protocol_treasury: UncheckedAccount<'info>,

    // Authority PDA (stores bumps, acts as mint auth signer)
    #[account(init, payer=authority, space=8 + 8, seeds=[AUTH_SEED], bump)]
    pub auth: Account<'info, Authorities>,
    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
pub struct SetCountryPause<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFees<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    /// CHECK: protocol treasury PDA
    #[account(mut, seeds=[PROTOCOL_TREASURY_SEED], bump)]
    pub protocol_treasury: UncheckedAccount<'info>,
    /// CHECK: recipient of withdrawn lamports (EOA or PDA)
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u16, virtual_sol: u128, virtual_token: u128)]
pub struct InitCountry<'info> {
    #[account(mut, has_one=authority)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer=authority, space=8 + 424, seeds=[COUNTRY_SEED, &id.to_le_bytes()], bump)]
    pub country: Account<'info, Country>,

    // Token‑2022 mint (created off‑chain). Set its mint_authority to AUTH PDA.
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    // Vault ATA owned by AUTH PDA
    #[account(init, payer=authority, associated_token::mint=mint, associated_token::authority=burn_mint_auth, associated_token::token_program=token_program)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: SOL treasury PDA (lamports holder)
    #[account(
        init,
        payer = authority,
        space = 0, // lamports-only, no data
        seeds = [TREASURY_SEED, &id.to_le_bytes()],
        bump
    )]
    pub sol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyOnCurve<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    /// CHECK: prize pot holder (same PDA)
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global_account: UncheckedAccount<'info>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(init_if_needed, payer=payer, associated_token::mint=mint, associated_token::authority=payer, associated_token::token_program=token_program)]
    pub buyer_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: SOL treasury PDA
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    /// CHECK: protocol treasury PDA
    #[account(mut, seeds=[PROTOCOL_TREASURY_SEED], bump)]
    pub protocol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellOnCurve<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    /// CHECK: prize pot holder (same PDA)
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global_account: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub seller_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    /// CHECK: protocol treasury PDA
    #[account(mut, seeds=[PROTOCOL_TREASURY_SEED], bump)]
    pub protocol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority (owner of token_vault)
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FreezeCurve<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
#[instruction(raydium_program: Pubkey, pool_state: Pubkey, raydium_vault_a: Pubkey, raydium_vault_b: Pubkey, sol_seed_lamports: u64, token_seed_amount: u64)]
pub struct SeedRaydiumPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: SOL treasury PDA (source of SOL)
    #[account(mut, seeds=[TREASURY_SEED, &country.id.to_le_bytes()], bump)]
    pub sol_treasury: UncheckedAccount<'info>,

    // PDA-owned token account (ATA of burn_mint_auth) to hold liquidity tokens
    #[account(init_if_needed, payer=authority, associated_token::mint=mint, associated_token::authority=burn_mint_auth, associated_token::token_program=token_program)]
    pub liquidity_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPresidentOffchain<'info> {
    pub updater: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
pub struct SetCountryQuoteOffchain<'info> {
    pub updater: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut, seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
pub struct AddAuthorizedUpdater<'info> {
    pub updater: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
pub struct RemoveAuthorizedUpdater<'info> {
    pub updater: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
pub struct EndRound<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
}

#[derive(Accounts)]
#[instruction(target_country_id: u16, random_country_id: u16)]
pub struct LaunchNuke<'info> {
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,

    // winner
    #[account(mut, seeds=[COUNTRY_SEED, &winner_country.id.to_le_bytes()], bump=winner_country.bump)]
    pub winner_country: Account<'info, Country>,
    pub president: Signer<'info>,

    // target
    #[account(mut, seeds=[COUNTRY_SEED, &target_country.id.to_le_bytes()], bump=target_country.bump)]
    pub target_country: Account<'info, Country>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &target_country.id.to_le_bytes()], bump)]
    pub target_sol_treasury: UncheckedAccount<'info>,

    // buyback resources
    #[account(mut)]
    pub winner_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub winner_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &winner_country.id.to_le_bytes()], bump)]
    pub winner_sol_treasury: UncheckedAccount<'info>,

    /// CHECK (donation leg)
    #[account(mut, seeds=[TREASURY_SEED, &random_country_id.to_le_bytes()], bump)]
    pub random_country_sol_treasury: UncheckedAccount<'info>,

    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ExecuteSecondPrize<'info> {
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global: Account<'info, Global>,
    /// CHECK
    #[account(mut, seeds=[GLOBAL_SEED], bump=global.bump)]
    pub global_account: UncheckedAccount<'info>,

    #[account(mut, seeds=[COUNTRY_SEED, &winner_country.id.to_le_bytes()], bump=winner_country.bump)]
    pub winner_country: Account<'info, Country>,
    #[account(mut)]
    pub winner_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub winner_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK
    #[account(mut, seeds=[TREASURY_SEED, &winner_country.id.to_le_bytes()], bump)]
    pub winner_sol_treasury: UncheckedAccount<'info>,
    /// CHECK: signer PDA for mint authority
    #[account(seeds=[AUTH_SEED], bump=auth.burn_mint_auth_bump)]
    pub burn_mint_auth: UncheckedAccount<'info>,
    #[account(seeds=[AUTH_SEED], bump=auth.bump)]
    pub auth: Account<'info, Authorities>,

    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct GetCountryPrice<'info> {
    #[account(seeds=[COUNTRY_SEED, &country.id.to_le_bytes()], bump=country.bump)]
    pub country: Account<'info, Country>,
}

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

declare_id!("CS5ZMcpfdSS7WTgTQp7xYeVN9af3UoAdrZyMgKr3s8Bt");

#[program]
pub mod dday_mini_program {
    use super::*;

    pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.authority.key();
        game.current_round = 1;
        game.round_duration = 30 * 24 * 60 * 60; // 30 days in seconds
        game.round_start_time = Clock::get()?.unix_timestamp;
        game.total_countries = 211;
        game.active_countries = 211;
        game.global_tax_rate = 100; // 1% in basis points
        game.bump = ctx.bumps.game;
        Ok(())
    }

    pub fn create_country_token(
        ctx: Context<CreateCountryToken>,
        country_id: u8,
        name: String,
        symbol: String,
    ) -> Result<()> {
        let country = &mut ctx.accounts.country;
        country.id = country_id;
        country.name = name.clone();
        country.symbol = symbol;
        country.market_cap = 0;
        country.president = Pubkey::default();
        country.president_holdings = 0;
        country.is_active = true;
        country.total_supply = 0;
        country.bonding_curve_cap = 333_000_000_000; // $333k in lamports (approx)
        country.deployed_to_uniswap = false;
        country.has_nuke = false;
        country.liquidity_rugged = false;
        country.bump = ctx.bumps.country;

        msg!(
            "Created country token mint: {} for {}",
            ctx.accounts.mint.key(),
            name
        );
        Ok(())
    }

    pub fn buy_country_tokens(ctx: Context<BuyCountryTokens>, amount: u64) -> Result<()> {
        let country = &mut ctx.accounts.country;
        let player_key = ctx.accounts.player.key();
        let player = &mut ctx.accounts.player;

        // Calculate price using bonding curve formula
        let price = calculate_bonding_curve_price(country.total_supply, amount)?;

        // Transfer SOL from player to game vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.game_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, price)?;

        // Mint tokens to buyer's associated token account
        let mint_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        );

        let bump = ctx.bumps.mint_authority;
        let mint_authority_seeds = &[
            b"mint_authority".as_slice(),
            &country.id.to_le_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&mint_authority_seeds[..]];

        anchor_spl::token::mint_to(mint_ctx.with_signer(signer_seeds), amount)?;

        // Update country state
        country.total_supply += amount;
        country.market_cap = calculate_market_cap(country.total_supply)?;

        // Update player holdings
        if let Some(holding) = player
            .country_holdings
            .iter_mut()
            .find(|h| h.country_id == country.id)
        {
            holding.amount += amount;
        } else {
            player.country_holdings.push(CountryHolding {
                country_id: country.id,
                amount,
                owner: player_key,
            });
        }

        // Update president if needed
        update_president(country, &player_key, &player.country_holdings)?;

        // Check if country should deploy to AMM
        if country.market_cap >= country.bonding_curve_cap && !country.deployed_to_uniswap {
            country.deployed_to_uniswap = true;
            msg!("Country {} deployed to AMM!", country.name);
        }

        Ok(())
    }

    pub fn get_country_info(ctx: Context<GetCountryInfo>, _country_id: u8) -> Result<CountryInfo> {
        let country = &ctx.accounts.country;
        let current_price = calculate_token_price(country.total_supply)?;
        let bonding_progress = get_bonding_curve_progress(country.total_supply);

        Ok(CountryInfo {
            id: country.id,
            name: country.name.clone(),
            symbol: country.symbol.clone(),
            market_cap: country.market_cap,
            current_price,
            total_supply: country.total_supply,
            bonding_progress,
            president: country.president,
            president_holdings: country.president_holdings,
            is_active: country.is_active,
            deployed_to_amm: country.deployed_to_uniswap,
            has_nuke: country.has_nuke,
        })
    }

    pub fn launch_nuke(ctx: Context<LaunchNuke>, _target_country_id: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let target_country = &mut ctx.accounts.target_country;
        let winner_country = &mut ctx.accounts.winner_country;

        // Verify caller is president of winning country
        require!(
            ctx.accounts.player.key() == winner_country.president,
            ErrorCode::NotPresident
        );
        // Verify winner country has nuke available
        require!(winner_country.has_nuke, ErrorCode::NoNukeAvailable);
        // Verify target country exists and is active
        require!(target_country.is_active, ErrorCode::CountryNotActive);

        // Execute nuke - rug target country's liquidity
        target_country.is_active = false;
        target_country.liquidity_rugged = true;
        winner_country.has_nuke = false;
        game.active_countries -= 1;

        msg!("Country {} nuked! Liquidity rugged", target_country.name);
        Ok(())
    }
}

// Helper function to update president
fn update_president(
    country: &mut Account<Country>,
    player_key: &Pubkey,
    holdings: &[CountryHolding],
) -> Result<()> {
    let mut max_holdings = 0;
    let mut new_president = Pubkey::default();

    for holding in holdings.iter() {
        if holding.country_id == country.id && holding.amount > max_holdings {
            max_holdings = holding.amount;
            new_president = *player_key;
        }
    }

    if max_holdings > country.president_holdings {
        country.president = new_president;
        country.president_holdings = max_holdings;
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(country_id: u8)]
pub struct CreateCountryToken<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Country::INIT_SPACE,
        seeds = [b"country", &country_id.to_le_bytes()],
        bump
    )]
    pub country: Account<'info, Country>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
        seeds = [b"mint", &country_id.to_le_bytes()],
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"mint_authority", &country_id.to_le_bytes()],
        bump
    )]
    /// CHECK: PDA that will be the mint authority
    pub mint_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyCountryTokens<'info> {
    #[account(
        mut,
        seeds = [b"country", &country.id.to_le_bytes()],
        bump = country.bump,
    )]
    pub country: Account<'info, Country>,
    #[account(
        mut,
        seeds = [b"mint", &country.id.to_le_bytes()],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"player", buyer.key().as_ref().as_ref()],
        bump = player.bump,
    )]
    pub player: Account<'info, Player>,
    #[account(
        mut,
        seeds = [b"mint_authority", &[country.id]],
        bump,
    )]
    /// CHECK: PDA that is the mint authority
    pub mint_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"game_vault"],
        bump,
    )]
    /// CHECK: PDA that holds SOL payments
    pub game_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(country_id: u8)]
pub struct GetCountryInfo<'info> {
    #[account(
        seeds = [b"country", &country_id.to_le_bytes()],
        bump = country.bump,
    )]
    pub country: Account<'info, Country>,
}

#[derive(Accounts)]
#[instruction(target_country_id: u8)]
pub struct LaunchNuke<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        seeds = [b"country", &target_country_id.to_le_bytes()],
        bump = target_country.bump,
    )]
    pub target_country: Account<'info, Country>,
    #[account(
        mut,
        seeds = [b"country", &winner_country.id.to_le_bytes()],
        bump = winner_country.bump,
    )]
    pub winner_country: Account<'info, Country>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game"],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Game {
    pub authority: Pubkey,
    pub current_round: u32,
    pub round_duration: i64,
    pub round_start_time: i64,
    pub total_countries: u8,
    pub active_countries: u8,
    pub global_tax_rate: u16, // in basis points
    pub bump: u8,
}

impl Game {
    pub const INIT_SPACE: usize = 32 + 4 + 8 + 8 + 1 + 1 + 2 + 1;
}

#[account]
pub struct Country {
    pub id: u8,
    pub name: String,
    pub symbol: String,
    pub market_cap: u64,
    pub president: Pubkey,
    pub president_holdings: u64,
    pub is_active: bool,
    pub total_supply: u64,
    pub bonding_curve_cap: u64,
    pub deployed_to_uniswap: bool,
    pub has_nuke: bool,
    pub liquidity_rugged: bool,
    pub bump: u8,
}

impl Country {
    pub const INIT_SPACE: usize = 1 + (4 + 20) + (4 + 10) + 8 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 1;
}

#[account]
pub struct Player {
    pub authority: Pubkey,
    pub country_holdings: Vec<CountryHolding>,
    pub total_holdings_value: u64,
    pub bump: u8,
}

impl Player {
    pub const INIT_SPACE: usize = 32 + (4 + 100 * CountryHolding::INIT_SPACE) + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CountryHolding {
    pub country_id: u8,
    pub amount: u64,
    pub owner: Pubkey,
}

impl CountryHolding {
    pub const INIT_SPACE: usize = 1 + 8 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CountryInfo {
    pub id: u8,
    pub name: String,
    pub symbol: String,
    pub market_cap: u64,
    pub current_price: u64,
    pub total_supply: u64,
    pub bonding_progress: u8,
    pub president: Pubkey,
    pub president_holdings: u64,
    pub is_active: bool,
    pub deployed_to_amm: bool,
    pub has_nuke: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Round has not ended yet")]
    RoundNotEnded,
    #[msg("You are not the president of this country")]
    NotPresident,
    #[msg("No nuke available")]
    NoNukeAvailable,
    #[msg("Country not found")]
    CountryNotFound,
    #[msg("Country is not active")]
    CountryNotActive,
    #[msg("Invalid bonding curve calculation")]
    InvalidBondingCurve,
    #[msg("Insufficient funds")]
    InsufficientFunds,
}

// Helper functions
fn calculate_bonding_curve_price(total_supply: u64, amount: u64) -> Result<u64> {
    // Pump.fun style bonding curve implementation
    let initial_virtual_sol_reserves = 107_300_000_000; // 107.3 SOL in lamports
    let initial_virtual_token_reserves = 1_073_000_000_000_000; // 1.073T tokens

    let current_virtual_sol_reserves = initial_virtual_sol_reserves;
    let current_virtual_token_reserves = initial_virtual_token_reserves - total_supply;

    // Calculate price for the given amount using constant product formula
    let numerator = amount * current_virtual_sol_reserves;
    let denominator = current_virtual_token_reserves - amount;

    if denominator == 0 {
        return Err(ErrorCode::InvalidBondingCurve.into());
    }

    let price = numerator / denominator;
    Ok(price)
}

fn calculate_market_cap(total_supply: u64) -> Result<u64> {
    let current_price = calculate_token_price(total_supply)?;
    let market_cap = current_price * total_supply;
    Ok(market_cap)
}

fn calculate_token_price(current_supply: u64) -> Result<u64> {
    if current_supply == 0 {
        return Ok(0);
    }
    calculate_bonding_curve_price(current_supply, 1_000_000) // 1 token with 6 decimals
}

fn get_bonding_curve_progress(total_supply: u64) -> u8 {
    let max_supply = 793_100_000_000_000; // Max tokens before AMM deployment
    let progress = (total_supply * 100) / max_supply;

    if progress > 100 {
        100
    } else {
        progress as u8
    }
}

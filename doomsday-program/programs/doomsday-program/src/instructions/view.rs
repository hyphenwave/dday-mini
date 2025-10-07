use crate::events::{CountryPrice, CountryPriceReturn};
use crate::*;
use anchor_lang::solana_program::program::set_return_data;

pub fn get_country_price(ctx: Context<crate::GetCountryPrice>) -> Result<()> {
    let c = &ctx.accounts.country;
    // Linear price: P = P0 + k * u, where u is cumulative units sold (base units)
    let step_units = c.step_tokens.max(1);
    let u_units =
        crate::utils::fold_units(c.current_step_index, c.sold_in_current_step, step_units);
    let p0 = c.step_base_price_lamports as u128; // lamports/token
    let k_e6 = c.curve_slope_per_token_sq_e6 as u128; // micro-lamports/token^2
    let micro = 1_000_000u128;
    let scale = 10u128.pow(crate::TOKEN_DECIMALS as u32); // base units per token
                                                          // price per token = P0 + (k_e6 * u_units) / (scale * 1e6)
    let inc = (k_e6.saturating_mul(u_units)) / (scale.saturating_mul(micro));
    let price = (p0.saturating_add(inc)).min(u128::from(u64::MAX)) as u64;
    emit!(CountryPrice {
        country: c.id,
        mode: c.mode,
        price_lamports_per_token: price,
        step_index: c.current_step_index,
    });
    Ok(())
}

pub fn get_country_price_view(ctx: Context<crate::GetCountryPrice>) -> Result<()> {
    let c = &ctx.accounts.country;
    let step_units = c.step_tokens.max(1);
    let u_units =
        crate::utils::fold_units(c.current_step_index, c.sold_in_current_step, step_units);
    let p0 = c.step_base_price_lamports as u128; // lamports/token
    let k_e6 = c.curve_slope_per_token_sq_e6 as u128; // micro-lamports/token^2
    let micro = 1_000_000u128;
    let scale = 10u128.pow(crate::TOKEN_DECIMALS as u32);
    let inc = (k_e6.saturating_mul(u_units)) / (scale.saturating_mul(micro));
    let price = (p0.saturating_add(inc)).min(u128::from(u64::MAX)) as u64;
    let ret = CountryPriceReturn {
        price_lamports_per_token: price,
        mode: c.mode,
        step_index: c.current_step_index,
    };
    let mut data = Vec::with_capacity(32);
    ret.serialize(&mut data).unwrap();
    set_return_data(&data);
    Ok(())
}

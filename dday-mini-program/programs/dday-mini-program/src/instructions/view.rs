use crate::events::{CountryPrice, CountryPriceReturn};
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::set_return_data;

pub fn get_country_price(ctx: Context<crate::GetCountryPrice>) -> Result<()> {
    let c = &ctx.accounts.country;
    let price = c.step_base_price_lamports.saturating_add(
        c.current_step_index
            .saturating_mul(c.step_price_increment_lamports),
    );
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
    let price = c.step_base_price_lamports.saturating_add(
        c.current_step_index
            .saturating_mul(c.step_price_increment_lamports),
    );
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

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::system_program;

pub fn transfer_lamports<'info>(
    system_program: &Program<'info, System>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    system_program::transfer(
        CpiContext::new(
            system_program.to_account_info(),
            system_program::Transfer { from, to },
        ),
        amount,
    )
}
pub fn transfer_lamports_signed<'info>(
    system_program: &Program<'info, System>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[u8]],
) -> Result<()> {
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            system_program::Transfer { from, to },
            &[signer_seeds],
        ),
        amount,
    )
}

pub fn accounts_contains(accs: &[AccountInfo], key: &Pubkey) -> bool {
    accs.iter().any(|ai| ai.key == key)
}

pub fn cpi_raydium_swap(
    raydium_program: Pubkey,
    remaining: &[AccountInfo],
    signer_seeds: &[&[u8]],
    data: Vec<u8>,
) -> Result<()> {
    let metas: Vec<AccountMeta> = remaining
        .iter()
        .map(|ai| AccountMeta {
            pubkey: *ai.key,
            is_signer: ai.is_signer,
            is_writable: ai.is_writable,
        })
        .collect();
    let ix = Instruction {
        program_id: raydium_program,
        accounts: metas,
        data,
    };
    invoke_signed(&ix, remaining, &[signer_seeds]).map_err(|e| e.into())
}

// single safe ceil div
#[inline(always)]
pub fn ceil_div_u128(n: u128, d: u128) -> u128 {
    if d == 0 {
        return u128::MAX;
    }
    (n.saturating_add(d.saturating_sub(1))) / d
}

#[inline(always)]
pub fn floor_div_u128(n: u128, d: u128) -> u128 {
    if d == 0 {
        return 0;
    }
    n / d
}

// Map (index, in_step) to a single u128 base-units-sold counter
#[inline(always)]
pub fn fold_units(idx: u64, in_step: u64, step_units: u64) -> u128 {
    (idx as u128)
        .saturating_mul(step_units as u128)
        .saturating_add(in_step as u128)
}

// Unfold u128 units back to (index, in_step)
#[inline(always)]
pub fn unfold_units(u_units: u128, step_units: u64) -> (u64, u64) {
    let step = step_units.max(1) as u128;
    let idx = (u_units / step) as u64;
    let rem = (u_units % step) as u64;
    (idx, rem)
}

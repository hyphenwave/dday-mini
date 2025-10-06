use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use crate::constants::*;

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

use anchor_lang::prelude::*;

pub const MAX_COUNTRIES: u16 = 211;
pub const BASIS_POINTS: u64 = 10_000; // 100% = 10000 bp

pub const GLOBAL_TAX_BP: u64 = 50; // 0.50% to global prize pot
pub const CURVE_FEE_BP_DEFAULT: u64 = 100; // 1.00% protocol fee (kept in treasury)
pub const NUKE_RUG_BP: u64 = 10_000; // 100% of target SOL treasury is rugged
pub const TOKEN_DECIMALS: u8 = 9; // All country mints use 9 decimals
pub const MIGRATE_THRESHOLD_USD_E6_DEFAULT: u64 = 80_000_000; // $80k in 1e6 precision

pub const GLOBAL_SEED: &[u8] = b"GLOBAL";
pub const COUNTRY_SEED: &[u8] = b"COUNTRY"; // + id.le_bytes()
pub const TREASURY_SEED: &[u8] = b"TREASURY"; // + id.le_bytes()
pub const AUTH_SEED: &[u8] = b"AUTH"; // mint/burn authority PDA (stores bumps)
pub const PROTOCOL_TREASURY_SEED: &[u8] = b"PROTO_TREASURY";

// Export all shared modules
export * from './logger'
export * from './rpc-manager'
export * from './config'
export * from './types'
export * from './utils'
export * from './idl'
export * from './utils/top-holder'

// Export specific items from program-client (avoiding conflicts with types)
export {
  DOOMSDAY_PROGRAM_ID,
  MAX_COUNTRIES,
  BASIS_POINTS,
  GLOBAL_TAX_BP,
  CURVE_FEE_BP_DEFAULT,
  NUKE_RUG_BP,
  TOKEN_DECIMALS,
  MIGRATE_THRESHOLD_USD_E6_DEFAULT,
  SEEDS,
  DoomsdayClient,
} from './program-client'

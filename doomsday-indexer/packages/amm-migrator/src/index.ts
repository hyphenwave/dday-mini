import { AnchorProvider, Idl } from '@coral-xyz/anchor'
import { Connection, Keypair } from '@solana/web3.js'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  DoomsdayClient,
  loadIdlFromEnv,
  MarketMode,
} from '@doomsday/shared'

const logger = createLogger('amm-migrator')

async function main() {
  try {
    validateConfig()

    const rpcManager = new RPCManager(config.solana.rpcEndpoint, [
      config.solana.backupRpc,
    ])
    const connection = await rpcManager.getConnection()

    const idl: Idl | null = loadIdlFromEnv()
    if (!idl) {
      logger.warn('IDL not provided via IDL_PATH; running read-only')
    }

    const wallet = Keypair.generate()
    const client = idl ? new DoomsdayClient(connection, wallet, idl) : null

    logger.logServiceStarted()

    const interval = setInterval(async () => {
      try {
        if (!client) return
        const countries = await client.fetchAllCountries()
        for (const country of countries) {
          if (country.mode === MarketMode.Amm) continue

          const threshold = Number(
            country.migrateThresholdUsdE6?.toString() || '0'
          )
          const marketcap = Number(country.quoteMarketcap?.toString() || '0')
          if (marketcap >= threshold) {
            if (config.service.enableDryRun) {
              logger.info(`DryRun: would migrate country ${country.id} to AMM`)
              continue
            }

            // 1) freeze_curve
            await client.freezeCurve(country.id)
            logger.info(`Curve frozen for ${country.id}`)

            // 2) seed_raydium_pool - placeholder: requires Raydium accounts, omitted here
            logger.info(`Seed Raydium pool (placeholder) for ${country.id}`)
          }
        }
      } catch (err) {
        logger.error('Migrator iteration failed', err)
      }
    }, 30_000)

    const shutdown = async (signal: string) => {
      clearInterval(interval)
      logger.logServiceStopped(signal)
      process.exit(0)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    logger.error('Failed to start amm-migrator', err)
    process.exit(1)
  }
}

main()

import { Idl } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  DoomsdayClient,
  getDoomsdayIdl,
  MarketMode,
} from '@doomsday/shared'

const logger = createLogger('buyback-orchestrator')

async function main() {
  try {
    validateConfig()

    const rpcManager = new RPCManager(config.solana.rpcEndpoint, [
      config.solana.backupRpc,
    ])
    const connection = await rpcManager.getConnection()

    const idl: Idl = getDoomsdayIdl()

    const wallet = Keypair.generate()
    const client = new DoomsdayClient(connection, wallet, idl)

    logger.logServiceStarted()

    const interval = setInterval(async () => {
      try {
        const countries = await client.fetchAllCountries()
        for (const c of countries) {
          if (c.mode !== MarketMode.Amm) continue
          // Placeholder: here we would build Raydium swap IX and pass as remaining accounts
          logger.debug(`Buyback check for country ${c.id}`)
        }
      } catch (err) {
        logger.error('Buyback iteration failed', err)
      }
    }, 60_000)

    const shutdown = async (signal: string) => {
      clearInterval(interval)
      logger.logServiceStopped(signal)
      process.exit(0)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    logger.error('Failed to start buyback-orchestrator', err)
    process.exit(1)
  }
}

main()

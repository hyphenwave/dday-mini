import * as anchor from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  DoomsdayClient,
  MarketMode,
  QuoteSource,
  lamportsToSol,
} from '@doomsday/shared'

const logger = createLogger('price-updater')

async function main() {
  try {
    validateConfig()

    const rpcManager = new RPCManager(config.solana.rpcEndpoint, [
      config.solana.backupRpc,
    ])
    const connection = await rpcManager.getConnection()

    // Use a dummy wallet in dry-run; transactions will be skipped
    const wallet = Keypair.generate()
    const client = new DoomsdayClient(connection, wallet)

    logger.logServiceStarted()

    // Simple polling loop; could be replaced with BullMQ similar to president-updater
    const interval = config.service.priceUpdateIntervalMs
    const timer = setInterval(async () => {
      try {
        await rpcManager.getConnection()

        // Fetch countries via client if available
        const countries = await client.fetchAllCountries()

        for (const country of countries) {
          let priceInSol = 0
          if (country.mode === MarketMode.Curve) {
            priceInSol = client.calculateCurvePrice(country)
          } else {
            // TODO: Raydium quote via reserves; placeholder uses stored quotePriceQ64 if present
            priceInSol = lamportsToSol(country.stepBasePriceLamports) // fallback placeholder
          }

          // Marketcap estimate
          const marketcap = client.calculateMarketCap(country, priceInSol)

          // Convert to expected program formats
          // price_q64: Q64.64 in lamports/SOL units; here simplified as lamports value placeholder
          const priceQ64 = new anchor.BN(Math.floor(priceInSol * 2 ** 64))
          const mcE6 = new anchor.BN(Math.floor(marketcap * 1_000_000))

          const source =
            country.mode === MarketMode.Curve
              ? QuoteSource.Curve
              : QuoteSource.Raydium

          // Send off-chain quote if not dry-run
          if (!config.service.enableDryRun) {
            await client.updateQuote(country.id, priceQ64, mcE6, source)
            logger.info(`Updated quote for country ${country.id}`)
          } else {
            logger.debug(`DryRun: would update quote for ${country.id}`, {
              priceInSol,
              marketcap,
            })
          }
        }
      } catch (err) {
        logger.error('Price update iteration failed', err)
      }
    }, interval)

    const shutdown = async (signal: string) => {
      clearInterval(timer)
      logger.logServiceStopped(signal)
      process.exit(0)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    logger.error('Failed to start price-updater', err)
    process.exit(1)
  }
}

main()

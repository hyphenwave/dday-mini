import * as anchor from '@coral-xyz/anchor'
import { Idl } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  DoomsdayClient,
  loadIdlFromEnv,
  calculateRoundDuration,
  getCurrentTimestamp,
} from '@doomsday/shared'

const logger = createLogger('round-scheduler')

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

    const tick = async () => {
      try {
        if (!client) return
        const global = await client.fetchGlobal()
        if (!global) return

        const now = getCurrentTimestamp()
        const endsAt = global.roundEndsAtUnix.toNumber()
        if (now >= endsAt) {
          const countries = await client.fetchAllCountries()
          let winnerId = 0
          let maxMc = -Infinity
          for (const c of countries) {
            // Use stored quoteMarketcap if present; fallback to derived (not ideal)
            const mc = Number(c.quoteMarketcap?.toString() || '0')
            if (mc > maxMc) {
              maxMc = mc
              winnerId = c.id
            }
          }

          const nextRoundIdx = global.roundIndex + 1
          const nextDuration = calculateRoundDuration(
            nextRoundIdx,
            config.round.initialRoundDurationDays,
            config.round.roundDurationDecreaseDays,
            config.round.minRoundDurationHours
          )
          const nextEnd = new anchor.BN(now + nextDuration)

          if (!config.service.enableDryRun) {
            await client.endRound(winnerId, nextEnd)
            logger.info(`Ended round ${global.roundIndex} winner=${winnerId}`)
          } else {
            logger.info(
              `DryRun: would end round ${global.roundIndex} winner=${winnerId}`
            )
          }
        }
      } catch (err) {
        logger.error('Round scheduler tick failed', err)
      }
    }

    const interval = setInterval(tick, 15_000)

    const shutdown = async (signal: string) => {
      clearInterval(interval)
      logger.logServiceStopped(signal)
      process.exit(0)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    logger.error('Failed to start round-scheduler', err)
    process.exit(1)
  }
}

main()

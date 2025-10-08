import {
  createLogger,
  config,
  validateConfig,
  DoomsdayClient,
  CountryRegistry,
  findTopHolderForMint,
  sleep,
} from '@doomsday/shared'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { Queue, Worker, Job } from 'bullmq'
import { PresidentUpdateJob } from '@doomsday/shared'
import Redis from 'ioredis'

const logger = createLogger('president-updater')

// Redis connection
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
})

// BullMQ queue for president update jobs
const presidentQueue = new Queue('president-updates', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

// Main service class
class PresidentUpdaterService {
  private worker: Worker | null = null

  async start() {
    try {
      // Validate configuration
      validateConfig()

      logger.logServiceStarted()

      // Initialize worker
      this.setupWorker()

      // Schedule recurring jobs
      await this.scheduleRecurringJobs()

      // Handle graceful shutdown
      this.setupShutdownHandlers()

      logger.info('President updater service started successfully')
    } catch (error) {
      logger.error('Failed to start president updater service', error)
      process.exit(1)
    }
  }

  private setupWorker() {
    this.worker = new Worker<PresidentUpdateJob>(
      'president-updates',
      async (job: Job<PresidentUpdateJob>) => {
        const { countryId } = job.data
        logger.info(`Processing president update for country ${countryId}`)

        try {
          // Load IDL and set up program client
          const connection = new Connection(
            config.solana.rpcEndpoint,
            'confirmed'
          )
          const wallet = Keypair.generate()
          const client = new DoomsdayClient(connection, wallet)

          // Fetch country to obtain mint and exclusion accounts; if not on-chain yet, fallback to registry
          const registry = new CountryRegistry()
          const country = await client.fetchCountry(countryId)

          let mint: PublicKey
          const excludeSet = new Set<string>()
          if (country) {
            mint = country.mint
            excludeSet.add(country.tokenVault.toBase58())
            if (country.raydiumVaultA)
              excludeSet.add(country.raydiumVaultA.toBase58())
            if (country.raydiumVaultB)
              excludeSet.add(country.raydiumVaultB.toBase58())
          } else {
            const entry = registry.getById(countryId)
            if (!entry?.mint) {
              logger.warn(
                `No on-chain country or registry mint for id ${countryId}`
              )
              return
            }
            mint = new PublicKey(entry.mint)
          }

          // Build exclusion sets
          const excludeOwners = new Set<string>(
            (process.env.PRESIDENT_EXCLUDE_OWNERS || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
          const excludeTokenAccounts = new Set<string>([
            ...excludeSet,
            ...(process.env.PRESIDENT_EXCLUDE_TOKEN_ACCOUNTS || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          ])

          const top = await findTopHolderForMint(connection, mint, {
            excludeOwners,
            excludeTokenAccounts,
            preferToken2022: true,
          })

          const topOwner = top?.owner || null
          const topAmount = top
            ? new anchor.BN(top.amountRaw.toString())
            : new anchor.BN(0)

          if (!topOwner) {
            logger.info(`No holder found for country ${countryId}`)
            return
          }

          // Read cache; skip if unchanged
          const cacheKey = `president:${countryId}`
          let cached: { owner: string; amount: string } | null = null
          try {
            const raw = await redis.get(cacheKey)
            if (raw) cached = JSON.parse(raw)
          } catch {}

          const nextOwner = topOwner.toBase58()
          const nextAmount = topAmount.toString()
          const unchanged =
            cached && cached.owner === nextOwner && cached.amount === nextAmount

          if (!unchanged) {
            if (!config.service.enableDryRun) {
              await client.setPresidentOffchain(countryId, topOwner, topAmount)
              logger.info(
                `Set president for ${countryId} to ${topOwner.toBase58()}`
              )
            } else {
              logger.debug(`DryRun: would set president for ${countryId}`, {
                owner: nextOwner,
                amount: nextAmount,
              })
            }

            // Update cache
            try {
              await redis.set(
                cacheKey,
                JSON.stringify({ owner: nextOwner, amount: nextAmount }),
                'EX',
                60 * 60
              )
            } catch {}
          } else {
            logger.debug(`President unchanged for country ${countryId}`)
          }

          logger.info(`Successfully updated president for country ${countryId}`)
        } catch (error) {
          logger.error(
            `Failed to update president for country ${countryId}`,
            error
          )
          throw error
        }
      },
      {
        connection: redis,
        concurrency: 20,
      }
    )

    this.worker.on('completed', (job: Job) => {
      logger.debug(`Job ${job.id} completed`)
    })

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`Job ${job?.id} failed`, err)
    })
  }

  private async scheduleRecurringJobs() {
    // Schedule updates for all 211 countries
    for (let countryId = 1; countryId <= 211; countryId++) {
      // stagger initial scheduling to spread load
      const jitter = Math.floor(
        Math.random() *
          Math.min(
            60000,
            Math.max(1000, config.service.presidentUpdateIntervalMs / 4)
          )
      )
      if (jitter > 0) await sleep(jitter)
      await presidentQueue.add(
        `update-country-${countryId}`,
        { countryId },
        {
          repeat: {
            every: config.service.presidentUpdateIntervalMs,
          },
        }
      )
    }

    logger.info('Scheduled recurring president update jobs for all countries')
  }

  private setupShutdownHandlers() {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`)

      // Close worker
      if (this.worker) {
        await this.worker.close()
      }

      // Close queue
      await presidentQueue.close()

      // Close Redis connection
      redis.disconnect()

      logger.logServiceStopped(signal)
      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  }

  async stop() {
    if (this.worker) {
      await this.worker.close()
    }
    await presidentQueue.close()
    redis.disconnect()
  }
}

// Start the service
const service = new PresidentUpdaterService()
service.start().catch((error) => {
  logger.error('Service startup failed', error)
  process.exit(1)
})

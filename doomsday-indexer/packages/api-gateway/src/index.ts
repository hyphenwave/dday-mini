import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import client from 'prom-client'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  CountryRegistry,
} from '@doomsday/shared'

const logger = createLogger('api-gateway')

async function bootstrap() {
  try {
    validateConfig()

    const app = express()
    app.use(helmet())
    app.use(cors())
    app.use(express.json())
    app.use(
      rateLimit({
        windowMs: 60_000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
      })
    )

    // Prometheus metrics
    client.collectDefaultMetrics({ prefix: 'doomsday_api_' })
    app.get('/metrics', async (_req, res) => {
      res.set('Content-Type', client.register.contentType)
      res.end(await client.register.metrics())
    })

    const rpcManager = new RPCManager(config.solana.rpcEndpoint, [
      config.solana.backupRpc,
    ])
    await rpcManager.getConnection()
    // const client = new DoomsdayClient(connection, wallet, idl)

    app.get('/api/health', async (_req, res) => {
      res.json({ status: 'ok' })
    })

    app.get('/api/countries', async (_req, res) => {
      const registry = new CountryRegistry()
      const countries = registry.list()
      res.json({ count: countries.length, countries })
    })

    app.get('/api/round', async (_req, res) => {
      try {
        const rm = new RPCManager(config.solana.rpcEndpoint, [
          config.solana.backupRpc,
        ])
        const connection = await rm.getConnection()
        const { DoomsdayClient } = require('@doomsday/shared')
        const { Keypair } = require('@solana/web3.js')
        const client = new DoomsdayClient(connection, Keypair.generate())
        const global = await client.fetchGlobal()
        if (!global) {
          res.status(503).json({ error: 'unavailable' })
          return
        }
        res.json({
          roundIndex: global.roundIndex,
          roundEndsAt: global.roundEndsAtUnix.toString(),
          winnerCountryId: global.winnerCountryId || null,
          countriesLive: global.countriesLive,
          paused: global.paused,
        })
      } catch (e: any) {
        res.status(500).json({ error: String(e?.message || e) })
      }
    })

    const port = config.api.port
    app.listen(port, () => {
      logger.logServiceStarted(port)
    })
  } catch (err) {
    logger.error('Failed to start api-gateway', err)
    process.exit(1)
  }
}

bootstrap()

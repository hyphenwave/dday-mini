import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import {
  createLogger,
  config,
  validateConfig,
  RPCManager,
  DoomsdayClient,
  loadIdlFromEnv,
} from '@doomsday/shared'
import { Connection, Keypair } from '@solana/web3.js'
import { Idl } from '@coral-xyz/anchor'

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

    const rpcManager = new RPCManager(config.solana.rpcEndpoint, [
      config.solana.backupRpc,
    ])
    const connection = await rpcManager.getConnection()
    const idl: Idl | null = loadIdlFromEnv()
    const wallet = Keypair.generate()
    const client = idl ? new DoomsdayClient(connection, wallet, idl) : null

    app.get('/api/health', async (_req, res) => {
      res.json({ status: 'ok' })
    })

    app.get('/api/countries', async (_req, res) => {
      if (!client) return res.status(503).json({ error: 'IDL not loaded' })
      const countries = await client.fetchAllCountries()
      res.json({ count: countries.length })
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

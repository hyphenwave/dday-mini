import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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

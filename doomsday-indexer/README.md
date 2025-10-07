# Doomsday Indexer System

A comprehensive microservices-based indexer for the Doomsday Solana game, handling off-chain operations, price tracking, round management, auto-migration, and API services.

## Architecture

This indexer uses a microservices architecture with the following components:

- **Shared Library**: Common utilities, types, and Solana program client
- **President Updater**: Tracks top token holders and updates presidents
- **Price Updater**: Monitors bonding curve and AMM prices
- **Round Scheduler**: Manages round timing and winner determination
- **AMM Migrator**: Handles threshold monitoring and liquidity migration
- **Buyback Orchestrator**: Executes token buybacks and burns
- **API Gateway**: REST API and WebSocket server for real-time updates

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Redis server
- Solana CLI (for local development)
- Docker & Docker Compose (optional)

### Installation

1. Clone the repository:
```bash
cd doomsday-indexer
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your `.env` file with appropriate values

### Development

Run all services in development mode:
```bash
npm run dev
```

Run individual services:
```bash
npm run dev:president    # President updater only
npm run dev:price        # Price updater only
npm run dev:api          # API gateway only
```

### Building

Build all packages:
```bash
npm run build
```

### Docker Deployment

Start all services with Docker:
```bash
docker-compose up -d
```

Stop services:
```bash
docker-compose down
```

## Configuration

Edit `.env` file to configure:

- Solana RPC endpoints
- Program ID
- Service intervals
- Redis connection
- API ports
- Logging levels

## Off-chain services and how to run them safely

### President (top holder) updater

- **What**: Periodically compute top holder per country; call `set_president_offchain(id, pubkey, amount)`.
- **How**: Index SPL Token-2022 balances for each country mint; compute free-balance (exclude vaults/LP); sign with `Global.authority` (multisig). Runs on a BullMQ queue, interval configurable via `PRESIDENT_UPDATE_INTERVAL_MS`. Can be disabled via `ENABLE_PRESIDENT_UPDATES=false`.

### Market cap/price updater

- **What**: Maintain off-chain price and MC; call `set_country_quote_offchain(price_q64, mc_e6, source, ts)`.
- **How**: For Curve mode use step price; for Amm use Raydium pool reserves; write Q64.64 price; sign with authority.

### Round scheduler

- **What**: At round end, compute winner (highest MC), call `end_round(winner_id, next_end_unix)`.
- **How**: Use MC snapshot near cutoff; produce `next_end_unix`; sign with authority; store a durable audit log. Round duration policy: first 7 days, then decrease by 1 day per round until reaching 8 hours, then stay fixed at 8 hours.

### Auto-migration to AMM

- **What**: When MC ≥ threshold, call `freeze_curve` then `seed_raydium_pool` with Raydium pool metadata and CPI ix data.
- **How**: Watch MC, ensure vault/treasury balances exist, build Raydium add-liquidity IX with PDA as signer, pass as remaining accounts; simulate before sending; sign with authority.

### AMM buyback (swap path)

- **What**: For nuke/second prize in Amm mode, assemble Raydium swap IX (WSOL→token) as remaining accounts, with slippage caps.
- **How**: Wrap SOL in PDA if needed; verify `pool_state`, `vaultA`/`vaultB` match stored in the Country; simulate swap off-chain and enforce min_out; pass remaining accounts in correct Raydium order; use strict slippage bps; submit CPI; then burn tokens from PDA’s ATA.

## API Endpoints

The API Gateway provides the following endpoints:

- `GET /api/countries` - Get all country data
- `GET /api/countries/:id` - Get specific country
- `GET /api/round` - Current round information
- `GET /api/leaderboard` - Market cap rankings
- `GET /api/prices` - All token prices
- `GET /api/presidents` - Current presidents
- `GET /api/health` - Service health check
- `GET /api/metrics` - Prometheus metrics
- `WS /ws` - WebSocket for real-time updates

## WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  // Handle events: president:updated, price:updated, round:ended, etc.
});
```

## Project Structure

```
doomsday-indexer/
├── packages/
│   ├── shared/                 # Shared utilities and types
│   ├── president-updater/      # President tracking service
│   ├── price-updater/          # Price monitoring service
│   ├── round-scheduler/        # Round management service
│   ├── amm-migrator/           # AMM migration service
│   ├── buyback-orchestrator/   # Buyback execution service
│   └── api-gateway/            # API and WebSocket server
├── docker-compose.yml         # Docker orchestration
├── .env.example              # Environment configuration template
└── package.json             # Root workspace configuration
```

## Testing

Run tests for all packages:
```bash
npm test
```

## Monitoring

- Health checks: `http://localhost:3000/health`
- Prometheus metrics: `http://localhost:9090/metrics`

## License

MIT
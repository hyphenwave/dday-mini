# World PvP Indexer System

A comprehensive microservices-based indexer for the World PvP Solana game, handling off-chain operations, price tracking, round management, and API services.

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
cd dday-mini-indexer
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
dday-mini-indexer/
├── packages/
│   ├── shared/                 # Shared utilities and types
│   ├── president-updater/      # President tracking service
│   ├── price-updater/          # Price monitoring service
│   ├── round-scheduler/        # Round management service
│   ├── amm-migrator/          # AMM migration service
│   ├── buyback-orchestrator/   # Buyback execution service
│   └── api-gateway/           # API and WebSocket server
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
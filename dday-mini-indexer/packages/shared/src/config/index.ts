import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  solana: {
    rpcEndpoint: string;
    backupRpc: string;
    programId: string;
    authorityKeypairPath: string;
  };
  service: {
    presidentUpdateIntervalMs: number;
    priceUpdateIntervalMs: number;
    enablePresidentUpdates: boolean;
    enableDryRun: boolean;
  };
  round: {
    initialRoundDurationDays: number;
    minRoundDurationHours: number;
    roundDurationDecreaseDays: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  api: {
    port: number;
    enableWebsocket: boolean;
  };
  logging: {
    level: string;
    enableVerboseLogging: boolean;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsPort: number;
  };
}

export const config: Config = {
  solana: {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    backupRpc: process.env.SOLANA_BACKUP_RPC || 'https://solana-api.projectserum.com',
    programId: process.env.PROGRAM_ID || 'CS5ZMcpfdSS7WTgTQp7xYeVN9af3UoAdrZyMgKr3s8Bt',
    authorityKeypairPath: process.env.AUTHORITY_KEYPAIR_PATH || './authority-wallet.json',
  },
  service: {
    presidentUpdateIntervalMs: parseInt(process.env.PRESIDENT_UPDATE_INTERVAL_MS || '3600000'),
    priceUpdateIntervalMs: parseInt(process.env.PRICE_UPDATE_INTERVAL_MS || '60000'),
    enablePresidentUpdates: process.env.ENABLE_PRESIDENT_UPDATES === 'true',
    enableDryRun: process.env.ENABLE_DRY_RUN === 'true',
  },
  round: {
    initialRoundDurationDays: parseInt(process.env.INITIAL_ROUND_DURATION_DAYS || '7'),
    minRoundDurationHours: parseInt(process.env.MIN_ROUND_DURATION_HOURS || '8'),
    roundDurationDecreaseDays: parseInt(process.env.ROUND_DURATION_DECREASE_DAYS || '1'),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    enableWebsocket: process.env.ENABLE_WEBSOCKET === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableVerboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true',
  },
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  },
};

// Validate critical configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.solana.rpcEndpoint) {
    errors.push('SOLANA_RPC_ENDPOINT is required');
  }

  if (!config.solana.programId) {
    errors.push('PROGRAM_ID is required');
  }

  if (!config.solana.authorityKeypairPath && !config.service.enableDryRun) {
    errors.push('AUTHORITY_KEYPAIR_PATH is required when not in dry-run mode');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
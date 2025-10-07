import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

// Core enums (duplicated here to avoid circular deps)
export enum CountryStatus {
  Active = 'Active',
  Nuked = 'Nuked',
}

export enum MarketMode {
  Curve = 'Curve',
  Amm = 'Amm',
}

export enum QuoteSource {
  Curve = 'Curve',
  Raydium = 'Raydium',
  Oracle = 'Oracle',
  Unknown = 'Unknown',
}

// Re-export account types from program-client
export type { GlobalAccount, CountryAccount } from '../program-client';

// Event types
export interface BoughtOnCurveEvent {
  round: number;
  country: number;
  buyer: PublicKey;
  solIn: anchor.BN;
  tokensOut: anchor.BN;
  priceBp: anchor.BN;
}

export interface SoldOnCurveEvent {
  round: number;
  country: number;
  seller: PublicKey;
  tokensIn: anchor.BN;
  solOut: anchor.BN;
  priceBp: anchor.BN;
}

export interface PresidentUpdatedEvent {
  country: number;
  president: PublicKey;
  topHolder: anchor.BN;
}

export interface RoundEndedEvent {
  roundIndex: number;
  winnerCountryId: number;
}

export interface NukeLaunchedEvent {
  roundIndex: number;
  winnerCountryId: number;
  targetCountryId: number;
  solRugged: anchor.BN;
  toBuyback: anchor.BN;
  toRandom: anchor.BN;
}

export interface CurveFrozenEvent {
  country: number;
}

export interface MigratedToAmmEvent {
  country: number;
  poolState: PublicKey;
  at: anchor.BN;
}

// API response types
export interface CountryData {
  id: number;
  name: string;
  status: CountryStatus;
  mode: MarketMode;
  mint: string;
  president: string | null;
  topHolderAmount: string;
  price: number;
  marketCap: number;
  supply: {
    minted: string;
    burned: string;
    circulating: string;
  };
  curve?: {
    frozen: boolean;
    currentStep: number;
    soldInStep: string;
    stepPrice: number;
  };
  amm?: {
    poolAddress: string;
    migratedAt: string;
  };
  lastUpdated: string;
}

export interface GlobalData {
  roundIndex: number;
  roundEndsAt: string;
  winnerCountryId: number | null;
  prizePool: string;
  countriesLive: number;
  paused: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  countryId: number;
  name: string;
  marketCap: number;
  price: number;
  president: string | null;
  change24h?: number;
}

// Job types for BullMQ
export interface PresidentUpdateJob {
  countryId: number;
  priority?: number;
}

export interface PriceUpdateJob {
  countryId: number;
  mode: MarketMode;
}

export interface RoundEndJob {
  roundIndex: number;
  winnerCountryId: number;
  nextRoundDuration: number;
}

export interface MigrationJob {
  countryId: number;
  marketCap: number;
}

export interface BuybackJob {
  countryId: number;
  amount: string;
  slippageBps: number;
}

// WebSocket message types
export interface WSMessage {
  type: WSMessageType;
  data: any;
  timestamp: string;
}

export enum WSMessageType {
  PRESIDENT_UPDATED = 'president:updated',
  PRICE_UPDATED = 'price:updated',
  ROUND_ENDED = 'round:ended',
  NUKE_LAUNCHED = 'nuke:launched',
  MIGRATION_COMPLETED = 'migration:completed',
  COUNTRY_STATUS_CHANGED = 'country:status',
  HEARTBEAT = 'heartbeat',
}

// Health check types
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: string;
  checks: {
    rpc: boolean;
    redis: boolean;
    program?: boolean;
  };
  metrics?: {
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
  };
}

// Metrics types
export interface ServiceMetrics {
  service: string;
  timestamp: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
}
import { PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

/**
 * Load a keypair from a JSON file
 */
export function loadKeypair(keypairPath: string): Keypair {
  const absolutePath = path.resolve(keypairPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Keypair file not found: ${absolutePath}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

/**
 * Convert BN to number safely
 */
export function bnToNumber(bn: anchor.BN): number {
  return bn.toNumber();
}

/**
 * Convert BN to string
 */
export function bnToString(bn: anchor.BN): string {
  return bn.toString();
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number | anchor.BN): number {
  const value = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return value / Math.pow(10, 9);
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * Math.pow(10, 9));
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: anchor.BN, decimals: number): string {
  const divisor = new anchor.BN(10).pow(new anchor.BN(decimals));
  const quotient = amount.div(divisor);
  const remainder = amount.mod(divisor);

  const quotientStr = quotient.toString();
  const remainderStr = remainder.toString().padStart(decimals, '0');

  // Remove trailing zeros
  const trimmed = remainderStr.replace(/0+$/, '');

  return trimmed.length > 0 ? `${quotientStr}.${trimmed}` : quotientStr;
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Sleep for a specified duration
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Operation failed after all retries');
}

/**
 * Batch array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Calculate round duration based on round number
 */
export function calculateRoundDuration(
  roundNumber: number,
  initialDays: number = 7,
  decreasePerRound: number = 1,
  minHours: number = 8
): number {
  if (roundNumber === 1) {
    return initialDays * 24 * 60 * 60;
  }

  const daysForRound = Math.max(1, initialDays - ((roundNumber - 1) * decreasePerRound));
  const hours = daysForRound * 24;

  if (hours <= minHours) {
    return minHours * 60 * 60;
  }

  return hours * 60 * 60;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Parse a public key string safely
 */
export function parsePublicKey(key: string | PublicKey): PublicKey | null {
  try {
    if (typeof key === 'string') {
      return new PublicKey(key);
    }
    return key;
  } catch {
    return null;
  }
}

/**
 * Check if a public key is valid
 */
export function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Unix timestamp to Date
 */
export function timestampToDate(timestamp: number | anchor.BN): Date {
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.toNumber();
  return new Date(ts * 1000);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Truncate a public key for display
 */
export function truncatePublicKey(pubkey: string | PublicKey, start: number = 4, end: number = 4): string {
  const key = typeof pubkey === 'string' ? pubkey : pubkey.toString();
  if (key.length <= start + end) return key;
  return `${key.slice(0, start)}...${key.slice(-end)}`;
}

/**
 * Calculate slippage amount
 */
export function calculateSlippage(amount: number, slippageBps: number): number {
  return Math.floor(amount * (1 - slippageBps / 10000));
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if dry run mode is enabled
 */
export function isDryRun(): boolean {
  return process.env.ENABLE_DRY_RUN === 'true';
}
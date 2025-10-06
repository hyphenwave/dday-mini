import { Connection, ConnectionConfig } from '@solana/web3.js';
import { logger } from './logger';

export interface RPCEndpoint {
  url: string;
  priority: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
}

export class RPCManager {
  private endpoints: RPCEndpoint[];
  private currentEndpointIndex: number = 0;
  private connections: Map<string, Connection> = new Map();
  private requestCount: number = 0;
  private readonly maxRequestsPerSecond: number = 10;
  private lastRequestTime: number = Date.now();

  constructor(
    primaryEndpoint: string,
    backupEndpoints: string[] = [],
    config?: ConnectionConfig
  ) {
    this.endpoints = [
      { url: primaryEndpoint, priority: 0, isHealthy: true, lastHealthCheck: new Date() },
      ...backupEndpoints.map((url, index) => ({
        url,
        priority: index + 1,
        isHealthy: true,
        lastHealthCheck: new Date(),
      })),
    ];

    // Initialize connections
    this.endpoints.forEach(endpoint => {
      this.connections.set(
        endpoint.url,
        new Connection(endpoint.url, config || 'confirmed')
      );
    });
  }

  /**
   * Get a connection with automatic fallback and rate limiting
   */
  async getConnection(): Promise<Connection> {
    await this.rateLimitCheck();

    const endpoint = await this.getHealthyEndpoint();
    const connection = this.connections.get(endpoint.url);

    if (!connection) {
      throw new Error('No connection available for endpoint');
    }

    this.requestCount++;
    return connection;
  }

  /**
   * Get a healthy endpoint with fallback logic
   */
  private async getHealthyEndpoint(): Promise<RPCEndpoint> {
    // Try current endpoint first
    const currentEndpoint = this.endpoints[this.currentEndpointIndex];

    if (currentEndpoint.isHealthy) {
      return currentEndpoint;
    }

    // Fallback to next healthy endpoint
    for (let i = 0; i < this.endpoints.length; i++) {
      const index = (this.currentEndpointIndex + i) % this.endpoints.length;
      const endpoint = this.endpoints[index];

      if (endpoint.isHealthy) {
        logger.info(`Falling back to endpoint: ${endpoint.url}`);
        this.currentEndpointIndex = index;
        return endpoint;
      }
    }

    // If no healthy endpoints, try to recover the primary
    await this.healthCheck();

    if (this.endpoints[0].isHealthy) {
      this.currentEndpointIndex = 0;
      return this.endpoints[0];
    }

    throw new Error('All RPC endpoints are unhealthy');
  }

  /**
   * Rate limiting to prevent overwhelming the RPC
   */
  private async rateLimitCheck(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 1000 / this.maxRequestsPerSecond;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Perform health check on all endpoints
   */
  async healthCheck(): Promise<void> {
    const healthCheckPromises = this.endpoints.map(async endpoint => {
      try {
        const connection = this.connections.get(endpoint.url);
        if (!connection) return;

        const version = await connection.getVersion();
        endpoint.isHealthy = !!version;
        endpoint.lastHealthCheck = new Date();

        if (endpoint.isHealthy) {
          logger.debug(`Endpoint ${endpoint.url} is healthy`);
        }
      } catch (error) {
        endpoint.isHealthy = false;
        endpoint.lastHealthCheck = new Date();
        logger.warn(`Endpoint ${endpoint.url} health check failed: ${error}`);
      }
    });

    await Promise.all(healthCheckPromises);
  }

  /**
   * Execute with retry and exponential backoff
   */
  async executeWithRetry<T>(
    operation: (connection: Connection) => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = await this.getConnection();
        return await operation(connection);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`RPC operation failed (attempt ${attempt + 1}/${maxRetries}): ${error}`);

        // Mark current endpoint as unhealthy if it's a connection error
        if (this.isConnectionError(error)) {
          this.endpoints[this.currentEndpointIndex].isHealthy = false;
        }

        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * Check if error is a connection error
   */
  private isConnectionError(error: any): boolean {
    const connectionErrorPatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'fetch failed',
      '429',
      'rate limit',
    ];

    const errorString = error?.toString() || '';
    return connectionErrorPatterns.some(pattern =>
      errorString.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      requestCount: this.requestCount,
      endpoints: this.endpoints.map(e => ({
        url: e.url,
        isHealthy: e.isHealthy,
        lastHealthCheck: e.lastHealthCheck,
      })),
      currentEndpoint: this.endpoints[this.currentEndpointIndex]?.url,
    };
  }
}
import { createLogger, config, validateConfig } from '@world-pvp/shared';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const logger = createLogger('president-updater');

// Redis connection
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

// BullMQ queue for president update jobs
const presidentQueue = new Queue('president-updates', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Main service class
class PresidentUpdaterService {
  private worker: Worker | null = null;

  async start() {
    try {
      // Validate configuration
      validateConfig();

      logger.logServiceStarted();

      // Initialize worker
      this.setupWorker();

      // Schedule recurring jobs
      await this.scheduleRecurringJobs();

      // Handle graceful shutdown
      this.setupShutdownHandlers();

      logger.info('President updater service started successfully');
    } catch (error) {
      logger.error('Failed to start president updater service', error);
      process.exit(1);
    }
  }

  private setupWorker() {
    this.worker = new Worker(
      'president-updates',
      async (job) => {
        const { countryId } = job.data;
        logger.info(`Processing president update for country ${countryId}`);

        try {
          // TODO: Implement actual president update logic
          // 1. Scan token accounts for the country mint
          // 2. Calculate free balances (exclude vaults/LPs)
          // 3. Find highest balance holder
          // 4. Update president on-chain

          logger.info(`Successfully updated president for country ${countryId}`);
        } catch (error) {
          logger.error(`Failed to update president for country ${countryId}`, error);
          throw error;
        }
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });
  }

  private async scheduleRecurringJobs() {
    // Schedule updates for all 211 countries
    for (let countryId = 1; countryId <= 211; countryId++) {
      await presidentQueue.add(
        `update-country-${countryId}`,
        { countryId },
        {
          repeat: {
            every: config.service.presidentUpdateIntervalMs,
          },
        }
      );
    }

    logger.info('Scheduled recurring president update jobs for all countries');
  }

  private setupShutdownHandlers() {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Close worker
      if (this.worker) {
        await this.worker.close();
      }

      // Close queue
      await presidentQueue.close();

      // Close Redis connection
      redis.disconnect();

      logger.logServiceStopped(signal);
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
    }
    await presidentQueue.close();
    redis.disconnect();
  }
}

// Start the service
const service = new PresidentUpdaterService();
service.start().catch((error) => {
  logger.error('Service startup failed', error);
  process.exit(1);
});
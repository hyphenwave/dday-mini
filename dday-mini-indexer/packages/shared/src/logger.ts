import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${service || 'system'}] ${level}: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Console format with colors
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

// File format without colors
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

class Logger {
  private winston: winston.Logger;
  private service: string;

  constructor(service: string = 'world-pvp-indexer') {
    this.service = service;

    const logLevel = process.env.LOG_LEVEL || 'info';
    const enableVerbose = process.env.ENABLE_VERBOSE_LOGGING === 'true';

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: consoleFormat,
        level: enableVerbose ? 'debug' : logLevel,
        silent: process.env.NODE_ENV === 'test',
      }),
    ];

    // Add file transports in production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
          format: fileFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          format: fileFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }

    this.winston = winston.createLogger({
      level: logLevel,
      defaultMeta: { service: this.service },
      transports,
    });
  }

  // Log methods
  debug(message: string, meta?: any) {
    this.winston.debug(message, meta);
  }

  info(message: string, meta?: any) {
    this.winston.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.winston.warn(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any) {
    if (error instanceof Error) {
      this.winston.error(message, {
        error: error.message,
        stack: error.stack,
        ...meta,
      });
    } else {
      this.winston.error(message, { error, ...meta });
    }
  }

  // Performance logging
  startTimer(): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      return duration;
    };
  }

  logPerformance(operation: string, duration: number, meta?: any) {
    this.info(`${operation} completed`, {
      duration: `${duration}ms`,
      ...meta,
    });
  }

  // Structured logging for specific events
  logRPCRequest(method: string, params?: any) {
    this.debug('RPC request', {
      method,
      params: params ? JSON.stringify(params).slice(0, 100) : undefined,
    });
  }

  logRPCResponse(method: string, success: boolean, duration?: number) {
    const level = success ? 'debug' : 'warn';
    this.winston.log(level, 'RPC response', {
      method,
      success,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  logTransactionSent(signature: string, instruction: string, meta?: any) {
    this.info('Transaction sent', {
      signature,
      instruction,
      ...meta,
    });
  }

  logTransactionConfirmed(signature: string, slot?: number) {
    this.info('Transaction confirmed', {
      signature,
      slot,
    });
  }

  logTransactionFailed(signature: string, error: string) {
    this.error('Transaction failed', undefined, {
      signature,
      error,
    });
  }

  // Service lifecycle logging
  logServiceStarted(port?: number) {
    this.info(`Service started`, {
      port,
      pid: process.pid,
      node: process.version,
    });
  }

  logServiceStopped(reason?: string) {
    this.info('Service stopped', { reason });
  }

  logHealthCheck(status: 'healthy' | 'unhealthy', details?: any) {
    const level = status === 'healthy' ? 'debug' : 'warn';
    this.winston.log(level, `Health check: ${status}`, details);
  }

  // Metrics logging
  logMetric(name: string, value: number, unit?: string, tags?: Record<string, string>) {
    this.debug('Metric recorded', {
      metric: name,
      value,
      unit,
      tags,
    });
  }

  // Create child logger for sub-modules
  child(meta: any): Logger {
    const childLogger = new Logger(`${this.service}:${meta.module || 'child'}`);
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for creating service-specific loggers
export const createLogger = (service: string) => new Logger(service);
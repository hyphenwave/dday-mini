import { Pool, PoolConfig } from 'pg';
import { createLogger } from './logger';

const logger = createLogger('database');

const poolConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'doomsday_game',
  user: process.env.POSTGRES_USER || 'doomsday_admin',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool(poolConfig);

    // Log connection errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
    });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Database query executed', {
        query: text.substring(0, 100),
        duration,
        rows: res.rowCount
      });
      return res;
    } catch (error) {
      logger.error('Database query failed', error, { query: text });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW()');
      logger.info('Database connected successfully');
      return true;
    } catch (error) {
      logger.error('Database connection test failed', error);
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }

  // Helper method for transactions
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper method to insert and return ID
  async insertReturning(table: string, data: Record<string, any>, returning = 'id') {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING ${returning}
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  // Helper for bulk inserts
  async bulkInsert(table: string, records: Record<string, any>[]) {
    if (records.length === 0) return;

    const keys = Object.keys(records[0]);
    const values: any[] = [];
    const placeholders: string[] = [];

    records.forEach((record, recordIndex) => {
      const recordPlaceholders = keys.map((key, keyIndex) => {
        const index = recordIndex * keys.length + keyIndex + 1;
        values.push(record[key]);
        return `$${index}`;
      });
      placeholders.push(`(${recordPlaceholders.join(', ')})`);
    });

    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${placeholders.join(', ')}
    `;

    return await this.query(query, values);
  }
}

export const db = Database.getInstance();
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const poolConnection = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'goshipping',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export const pool = poolConnection;
export const db = drizzle(poolConnection, { schema, mode: 'default' });

/**
 * Health check helper to verify database connectivity
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const conn = await poolConnection.getConnection();
    await conn.ping();
    conn.release();
    return { ok: true, message: 'Database connected successfully' };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Database connection error' };
  }
}

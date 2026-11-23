import pg from 'pg';
import { readFile } from 'node:fs/promises';

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
  } : undefined;
  if (ssl) {
    // pg lets URL SSL flags replace the ssl object. Keep verification and the configured CA.
    const connectionUrl = new URL(connectionString);
    for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) connectionUrl.searchParams.delete(name);
    connectionString = connectionUrl.toString();
  }
  return new Pool({ connectionString, ssl, max: 10, idleTimeoutMillis: 30_000 });
}

export async function initializeDatabase(pool) {
  const sql = await readFile(new URL('../migrations/001_user_state.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

export async function getState(pool, userId) {
  const result = await pool.query(
    'SELECT state, version, updated_at FROM user_state WHERE user_id = $1',
    [userId],
  );
  if (!result.rowCount) return null;
  return { state: result.rows[0].state, version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at };
}

export async function putState(pool, userId, state, expectedVersion) {
  const result = expectedVersion === 0
    ? await pool.query(`INSERT INTO user_state (user_id, state) VALUES ($1, $2::jsonb)
        ON CONFLICT (user_id) DO NOTHING RETURNING version, updated_at`, [userId, JSON.stringify(state)])
    : await pool.query(`UPDATE user_state SET state = $2::jsonb, version = version + 1, updated_at = NOW()
        WHERE user_id = $1 AND version = $3 RETURNING version, updated_at`, [userId, JSON.stringify(state), expectedVersion]);
  if (!result.rowCount) return null;
  return { version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at };
}

import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString, ssl, max: 10, idleTimeoutMillis: 30_000 });
}

export async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      workspace_id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getState(pool, workspaceId) {
  const result = await pool.query(
    'SELECT state, version, updated_at FROM app_state WHERE workspace_id = $1',
    [workspaceId],
  );
  if (!result.rowCount) return null;
  return { state: result.rows[0].state, version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at };
}

export async function putState(pool, workspaceId, state) {
  const result = await pool.query(
    `INSERT INTO app_state (workspace_id, state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (workspace_id) DO UPDATE
       SET state = EXCLUDED.state, version = app_state.version + 1, updated_at = NOW()
     RETURNING version, updated_at`,
    [workspaceId, JSON.stringify(state)],
  );
  return { version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at };
}

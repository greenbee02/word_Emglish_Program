import { mkdir, writeFile } from 'node:fs/promises';
import { createPool } from '../src/database.js';
const pool = createPool();
const client = await pool.connect();
try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables = {};
  for (const name of ['app_state', 'user_state']) {
    const exists = await client.query('SELECT to_regclass($1) AS name', [`public.${name}`]);
    if (exists.rows[0].name) tables[name] = (await client.query(`SELECT * FROM public.${name}`)).rows;
  }
  await client.query('COMMIT');
  const folder = new URL('../../.backups/', import.meta.url);
  await mkdir(folder, { recursive: true });
  const file = new URL(`database-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, folder);
  await writeFile(file, JSON.stringify({ format: 'word-garden-database-v1', createdAt: new Date().toISOString(), tables }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Application data backup saved:', file.pathname);
  console.log('Rows:', Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])));
} finally { client.release(); await pool.end(); }

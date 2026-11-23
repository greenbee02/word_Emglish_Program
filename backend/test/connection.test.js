import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPool } from '../src/database.js';
test('URL SSL flags cannot disable explicit certificate verification', async () => {
  const previous = process.env.DB_SSL, previousCa = process.env.DB_SSL_CA;
  process.env.DB_SSL = 'true'; delete process.env.DB_SSL_CA;
  let pool;
  try {
    pool = createPool('postgresql://test:password@localhost:5432/test?sslmode=disable&uselibpqcompat=true');
    const client = new pg.Client(pool.options);
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  } finally {
    if (pool) await pool.end();
    if (previous === undefined) delete process.env.DB_SSL; else process.env.DB_SSL = previous;
    if (previousCa === undefined) delete process.env.DB_SSL_CA; else process.env.DB_SSL_CA = previousCa;
  }
});

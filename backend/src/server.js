import http from 'node:http';
import { createRequestHandler, parseAllowedOrigins } from './app.js';
import { createPool, getState, initializeDatabase, putState } from './database.js';
import { createAuthenticator } from './auth.js';

const port = Number(process.env.PORT || 3000);
const authenticate = createAuthenticator({ url: process.env.SUPABASE_URL, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY });
const allowedOrigins = parseAllowedOrigins(process.env.FRONTEND_ORIGIN);
if (!allowedOrigins.length) throw new Error('FRONTEND_ORIGIN is required');
const pool = createPool();
if (process.env.AUTO_MIGRATE === 'true') await initializeDatabase(pool);
await pool.query('SELECT user_id FROM public.user_state LIMIT 0');

const server = http.createServer(createRequestHandler({
  pool,
  getState,
  putState,
  authenticate,
  allowedOrigins,
}));

server.listen(port, '0.0.0.0', () => console.log(`Word Garden API listening on port ${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

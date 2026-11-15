import http from 'node:http';
import { createRequestHandler, parseAllowedOrigins } from './app.js';
import { createPool, getState, initializeDatabase, putState } from './database.js';

const port = Number(process.env.PORT || 3000);
const pool = createPool();
await initializeDatabase(pool);

const server = http.createServer(createRequestHandler({
  pool,
  getState,
  putState,
  workspaceId: process.env.WORKSPACE_ID || 'default',
  allowedOrigins: parseAllowedOrigins(process.env.FRONTEND_ORIGIN),
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

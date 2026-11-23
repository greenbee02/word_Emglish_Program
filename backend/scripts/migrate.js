import { createPool, initializeDatabase } from '../src/database.js';
const pool = createPool();
try {
  await initializeDatabase(pool);
  console.log('user_state migration completed. Legacy data was preserved.');
} finally { await pool.end(); }

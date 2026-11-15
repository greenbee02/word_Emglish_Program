import { validateState } from './state.js';

const MAX_BODY_BYTES = 20 * 1024 * 1024;

export function parseAllowedOrigins(value = '') {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function setCors(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const allowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);
  if (!allowed) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body');
    error.status = 400;
    throw error;
  }
}

export function createRequestHandler({ pool, getState, putState, workspaceId = 'default', allowedOrigins = [] }) {
  return async function handler(req, res) {
    if (!setCors(req, res, allowedOrigins)) return sendJson(res, 403, { error: 'Origin is not allowed' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1');
        return sendJson(res, 200, { status: 'ok' });
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const stored = await getState(pool, workspaceId);
        return sendJson(res, 200, stored ?? { state: null, version: 0, updatedAt: null });
      }
      if (req.method === 'PUT' && url.pathname === '/api/state') {
        const body = await readJson(req);
        const validation = validateState(body.state);
        if (!validation.valid) return sendJson(res, 400, { error: validation.message });
        const saved = await putState(pool, workspaceId, body.state);
        return sendJson(res, 200, { saved: true, ...saved });
      }
      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      console.error(error);
      return sendJson(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    }
  };
}

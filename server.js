require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const initialize = require('./database/initialize');
const { verifyPassword, newSessionToken, hashToken } = require('./auth');

const app = express();
const port = Number(process.env.PORT) || 3001;
const sessionDays = 30;
const cookieName = 'princeos_session';
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy .env.example to .env and update it.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
const modules = ['events', 'transactions', 'tasks', 'habits', 'goals', 'fitness', 'notes'];
const loginAttempts = new Map();

async function initializeDatabase() {
  const client = await pool.connect();
  try { await initialize(client); } finally { client.release(); }
}
function cookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const at = value.indexOf('=');
    return [decodeURIComponent(value.slice(0, at)), decodeURIComponent(value.slice(at + 1))];
  }));
}
function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return cookieName + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure;
}
async function authenticate(request, response, next) {
  try {
    const token = cookies(request)[cookieName];
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    const result = await pool.query(`SELECT users.id, users.username, users.display_name
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`, [hashToken(token)]);
    if (!result.rowCount) {
      response.setHeader('Set-Cookie', sessionCookie('', 0));
      return response.status(401).json({ error: 'Session expired.' });
    }
    request.userId = result.rows[0].id;
    request.user = result.rows[0];
    next();
  } catch (error) { next(error); }
}

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb', type: 'application/json' }));
const brainDumpHandler = import('./brain-dump-agent.mjs').then(module => module.createBrainDumpHandler());
app.post('/api/brain-dump', authenticate, async (request, response, next) => {
  try { await (await brainDumpHandler)(request, response); } catch (error) { next(error); }
});
app.get('/api/health', async (_request, response, next) => {
  try { await pool.query('SELECT 1'); response.json({ status: 'ok', database: 'postgresql' }); } catch (error) { next(error); }
});
app.post('/api/auth/login', async (request, response, next) => {
  try {
    const key = request.ip || 'unknown';
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.blockedUntil > Date.now()) return response.status(429).json({ error: 'Too many attempts. Try again shortly.' });
    const username = String(request.body?.username || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const result = await pool.query('SELECT id, username, display_name, password_salt, password_hash FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    const valid = user && await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      const failures = (attempt?.failures || 0) + 1;
      loginAttempts.set(key, { failures, blockedUntil: failures >= 5 ? Date.now() + 60_000 : 0 });
      return response.status(401).json({ error: 'Invalid username or password.' });
    }
    loginAttempts.delete(key);
    const token = newSessionToken();
    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')", [hashToken(token), user.id]);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Set-Cookie', sessionCookie(token, sessionDays * 24 * 60 * 60));
    response.json({ user: { username: user.username, displayName: user.display_name } });
  } catch (error) { next(error); }
});
app.get('/api/auth/me', authenticate, (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({ user: { username: request.user.username, displayName: request.user.display_name } });
});
app.post('/api/auth/logout', authenticate, async (request, response, next) => {
  try {
    const token = cookies(request)[cookieName];
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    response.setHeader('Set-Cookie', sessionCookie('', 0));
    response.json({ signedOut: true });
  } catch (error) { next(error); }
});
app.get('/api/state', authenticate, async (request, response, next) => {
  try {
    const result = await pool.query('SELECT module, record_id, payload FROM module_records WHERE user_id = $1 ORDER BY addtime, record_id', [request.userId]);
    const data = Object.fromEntries(modules.map(module => [module, module === 'events' ? {} : []]));
    for (const row of result.rows) {
      if (row.module === 'events') {
        const date = row.record_id.slice(0, 10);
        if (!data.events[date]) data.events[date] = [];
        data.events[date].push(row.payload);
      } else data[row.module].push(row.payload);
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json({ data });
  } catch (error) { next(error); }
});
app.put('/api/state', authenticate, async (request, response, next) => {
  const state = request.body;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return response.status(400).json({ error: 'A complete state object is required.' });
  const records = [];
  const keys = new Set();
  try {
    for (const module of modules) {
      const source = state[module];
      if (module === 'events' ? !source || typeof source !== 'object' || Array.isArray(source) : !Array.isArray(source)) throw new Error('Invalid ' + module + ' collection');
      const groups = module === 'events' ? Object.entries(source) : [['', source]];
      for (const [date, items] of groups) {
        if (!Array.isArray(items) || (module === 'events' && !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Invalid event date or collection');
        for (const item of items) {
          if (!item || typeof item !== 'object' || Array.isArray(item) || !['string', 'number'].includes(typeof item.id) || String(item.id).trim() === '') throw new Error('Each record requires an id');
          if (module === 'transactions' && (!['spending', 'expense', 'savings'].includes(item.type)
            || typeof item.name !== 'string' || !item.name.trim()
            || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0
            || (item.notes !== undefined && typeof item.notes !== 'string'))) throw new Error('Invalid transaction');
          const recordId = module === 'events' ? date + ':' + item.id : String(item.id);
          const key = JSON.stringify([module, recordId]);
          if (keys.has(key)) throw new Error('Duplicate record id');
          keys.add(key);
          records.push({ module, record_id: recordId, payload: item });
        }
      }
    }
  } catch (error) { return response.status(400).json({ error: error.message }); }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [request.userId]);
    for (const record of records) {
      await client.query(`INSERT INTO module_records (user_id, module, record_id, payload) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, module, record_id) DO UPDATE SET payload = EXCLUDED.payload
        WHERE module_records.payload IS DISTINCT FROM EXCLUDED.payload`, [request.userId, record.module, record.record_id, record.payload]);
    }
    await client.query(`DELETE FROM module_records existing WHERE user_id = $1 AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS incoming(module text, record_id text)
      WHERE incoming.module = existing.module AND incoming.record_id = existing.record_id
    )`, [request.userId, JSON.stringify(records)]);
    await client.query('COMMIT');
    response.json({ saved: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { if (client) client.release(); }
});

const distribution = path.join(__dirname, 'dist');
if (fs.existsSync(distribution)) { app.use(express.static(distribution)); app.get('*', (_request, response) => response.sendFile(path.join(distribution, 'index.html'))); }
app.use((error, _request, response, _next) => { console.error(error); response.status(500).json({ error: 'Request failed.' }); });
initializeDatabase().then(() => app.listen(port, '127.0.0.1', () => console.log(`PrinceOS API running at http://127.0.0.1:${port}`))).catch(error => { console.error('PostgreSQL initialization failed:', error.message); process.exit(1); });

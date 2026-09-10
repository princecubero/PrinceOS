require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = Number(process.env.PORT) || 3001;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy .env.example to .env and update it.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
const modules = ['events', 'transactions', 'tasks', 'habits', 'goals', 'fitness', 'notes'];
const demoUser = { id: 'demo-user', email: 'demo@princeos.local', name: 'Prince' };

async function initializeDatabase() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8'));
  await pool.query(`INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = NOW()`, [demoUser.id, demoUser.email, demoUser.name]);
}

app.use(express.json({ limit: '2mb' }));
app.use((request, _response, next) => { request.userId = request.header('x-user-id') || demoUser.id; next(); });
app.get('/api/health', async (_request, response, next) => {
  try { await pool.query('SELECT 1'); response.json({ status: 'ok', database: 'postgresql' }); } catch (error) { next(error); }
});
app.get('/api/state', async (request, response, next) => {
  try {
    const result = await pool.query('SELECT module, record_id, payload FROM module_records WHERE user_id = $1 ORDER BY updated_at', [request.userId]);
    if (!result.rows.length) return response.json({ data: null });
    const data = Object.fromEntries(modules.map(module => [module, module === 'events' ? {} : []]));
    for (const row of result.rows) {
      if (row.module === 'events') {
        const date = row.record_id.slice(0, 10);
        if (!data.events[date]) data.events[date] = [];
        data.events[date].push(row.payload);
      }
      else data[row.module].push(row.payload);
    }
    response.json({ data });
  } catch (error) { next(error); }
});
app.put('/api/state', async (request, response, next) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) return response.status(400).json({ error: 'A state object is required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM module_records WHERE user_id = $1', [request.userId]);
    for (const module of modules) {
      const source = request.body[module] || (module === 'events' ? {} : []);
      const records = module === 'events' ? Object.entries(source).flatMap(([date, items]) => items.map(item => [`${date}:${item.id}`, item])) : source.map(item => [String(item.id), item]);
      for (const [recordId, payload] of records) await client.query('INSERT INTO module_records (user_id, module, record_id, payload) VALUES ($1, $2, $3, $4)', [request.userId, module, recordId, payload]);
    }
    await client.query('COMMIT');
    response.json({ saved: true });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

const distribution = path.join(__dirname, 'dist');
if (fs.existsSync(distribution)) { app.use(express.static(distribution)); app.get('*', (_request, response) => response.sendFile(path.join(distribution, 'index.html'))); }
app.use((error, _request, response, _next) => { console.error(error); response.status(500).json({ error: 'Database request failed.' }); });
initializeDatabase().then(() => app.listen(port, '127.0.0.1', () => console.log(`PrinceOS API running at http://127.0.0.1:${port}`))).catch(error => { console.error('PostgreSQL initialization failed:', error.message); process.exit(1); });

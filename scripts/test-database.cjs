const assert = require('assert');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env') });
const { Client } = require(path.join(root, 'node_modules/pg'));
const initialize = require(path.join(root, 'database/initialize'));
const { hashPassword } = require(path.join(root, 'auth'));
const schema = 'princeos_test_' + Date.now();
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
const empty = () => ({ events: {}, transactions: [], tasks: [], habits: [], goals: [], fitness: [], notes: [] });
let server;
let port;
let cookie = '';
function request(method, state, route = '/api/state') {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), cookies: res.headers['set-cookie'] || [] }));
    });
    req.on('error', reject);
    req.end(state ? JSON.stringify(state) : undefined);
  });
}
async function row() { return (await client.query("SELECT * FROM module_records WHERE record_id = 'test-record' AND module = 'tasks'")).rows[0]; }
async function main() {
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE module_records (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, module TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, module, record_id));
    INSERT INTO users (id, email, display_name) VALUES ('demo-user', 'demo@princeos.local', 'Prince');`);
  const sample = { id: 1, title: 'Prepare client presentation', detail: 'Today \u00b7 High priority', done: false };
  await client.query("INSERT INTO module_records VALUES ('demo-user', 'tasks', '1', $1, '2025-01-01T00:00:00Z'), ('demo-user', 'tasks', '2', $2, '2025-01-02T00:00:00Z')", [sample, { id: 2, title: 'User-edited task', done: false }]);
  await initialize(client);
  assert.equal((await client.query("SELECT * FROM users WHERE id = 'demo-user'")).rowCount, 0);
  const retained = (await client.query('SELECT * FROM module_records')).rows;
  assert.equal(retained.length, 1);
  assert.equal(retained[0].user_id, 'local-user');
  assert.equal(retained[0].payload.title, 'User-edited task');
  assert.equal(retained[0].addtime.toISOString(), '2025-01-02T00:00:00.000Z');
  for (const table of ['users', 'module_records']) {
    const columns = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2', [schema, table])).rows.map(x => x.column_name);
    assert(columns.includes('addtime') && columns.includes('updatetime'));
    assert(!columns.includes('created_at') && !columns.includes('updated_at'));
  }
  await initialize(client);
  assert.equal((await client.query('SELECT * FROM module_records')).rowCount, 1);
  const credentials = await hashPassword('A-test-password-2026!');
  await client.query("UPDATE users SET username = 'test-user', password_salt = $1, password_hash = $2 WHERE id = 'local-user'", [credentials.salt, credentials.hash]);
  console.log('PASS legacy migration, exact sample cleanup, custom-data preservation, repeatability');
  // Verify new installations independently, in another disposable schema.
  await client.query(`CREATE SCHEMA ${schema}_fresh`);
  await client.query(`SET search_path TO ${schema}_fresh`);
  await initialize(client);
  assert.equal((await client.query('SELECT * FROM module_records')).rowCount, 0);
  assert.equal((await client.query('SELECT * FROM users')).rows[0].email, null);
  await client.query(`SET search_path TO ${schema}`);
  console.log('PASS fresh database starts empty without a demo identity');
  port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => resolve(value)); }); });
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', '-c search_path=' + schema);
  server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATABASE_URL: url.toString(), PORT: String(port) }, windowsHide: true });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Test server startup timed out: ' + output)), 15000);
    server.stdout.on('data', chunk => { output += chunk; if (output.includes('PrinceOS API running')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { output += chunk; });
    server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited: ' + code + ' ' + output)); });
  });
  assert.equal((await request('GET')).status, 401);
  const login = await request('POST', { username: 'test-user', password: 'A-test-password-2026!' }, '/api/auth/login');
  assert.equal(login.status, 200);
  cookie = login.cookies[0].split(';')[0];
  let state = empty();
  state.tasks.push({ id: 'test-record', title: 'Timestamp check', done: false });
  assert.equal((await request('PUT', state)).status, 200);
  const inserted = await row();
  assert(inserted.addtime && inserted.updatetime);
  assert.equal((await request('PUT', state)).status, 200);
  const unchanged = await row();
  assert.equal(+unchanged.addtime, +inserted.addtime);
  assert.equal(+unchanged.updatetime, +inserted.updatetime);
  state.tasks[0].done = true;
  assert.equal((await request('PUT', state)).status, 200);
  const changed = await row();
  assert.equal(+changed.addtime, +inserted.addtime);
  assert(+changed.updatetime > +inserted.updatetime);
  assert.equal((await request('GET')).body.data.tasks[0].done, true);
  assert.equal((await request('PUT', { tasks: [] })).status, 400);
  assert.equal((await row()).payload.done, true);
  assert.equal((await request('PUT', { ...state, tasks: [state.tasks[0], state.tasks[0]] })).status, 400);
  assert.equal((await request('PUT', empty())).status, 200);
  assert.deepEqual((await request('GET')).body.data, empty());
  console.log('PASS API insert, unchanged save, update timestamps, reload, invalid input, delete, empty state');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  if (/^princeos_test_\d+$/.test(schema)) {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS ${schema}_fresh CASCADE`);
  }
  await client.end();
});


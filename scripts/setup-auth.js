require('dotenv').config();
const { Client } = require('pg');
const readline = require('readline');
const initialize = require('../database/initialize');
const { hashPassword } = require('../auth');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

async function setup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env');
  const username = (process.env.PRINCEOS_USERNAME || await ask('Username: ')).toLowerCase();
  const password = process.env.PRINCEOS_PASSWORD || await ask('Password (10+ characters): ');
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new Error('Username must be 3-50 characters using letters, numbers, dot, underscore, or hyphen.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  const credentials = await hashPassword(password);
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    await initialize(client);
    await client.query('BEGIN');
    await client.query('UPDATE users SET username = $1, password_salt = $2, password_hash = $3 WHERE id = $4', [username, credentials.salt, credentials.hash, 'local-user']);
    await client.query("DELETE FROM sessions WHERE user_id = 'local-user'");
    await client.query('COMMIT');
    console.log('Login configured for username: ' + username);
    console.log('Existing sessions were signed out.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

setup().catch(error => { console.error('Login setup failed: ' + error.message); process.exit(1); });

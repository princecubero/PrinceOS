require('dotenv').config();
const initialize = require('../database/initialize');
const { Client } = require('pg');

async function setup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env');
  const targetUrl = new URL(process.env.DATABASE_URL);
  const databaseName = targetUrl.pathname.slice(1);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) throw new Error('DATABASE_URL contains an invalid database name');

  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = '/postgres';
  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const admin = new Client({ connectionString: adminUrl.toString(), ssl });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  const database = new Client({ connectionString: targetUrl.toString(), ssl });
  await database.connect();
  await initialize(database);
  const tables = await database.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  await database.end();
  console.log(`Database "${databaseName}" is ready.`);
  console.log(`Tables: ${tables.rows.map(row => row.tablename).join(', ')}`);
}

setup().catch(error => {
  console.error(`Database setup failed: ${error.message}`);
  process.exit(1);
});

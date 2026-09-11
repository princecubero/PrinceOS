const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async function initialize(client) {
  await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await client.query('BEGIN');
  try {
    // Local, single-user profile: use the operating-system account, not a demo identity.
    await client.query('INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', ['local-user', os.userInfo().username]);
    const legacy = await client.query("SELECT id FROM users WHERE id = 'demo-user' AND email = 'demo@princeos.local' FOR UPDATE");
    if (legacy.rowCount) {
      // Only exact shipped samples are removed; edited/custom records are retained.
      const samples = [
  [
    "events",
    "2024-09-18:1",
    {
      "id": 1,
      "time": "09:30",
      "title": "Product design review",
      "color": ""
    }
  ],
  [
    "events",
    "2024-09-18:2",
    {
      "id": 2,
      "time": "12:30",
      "title": "Lunch with Claire",
      "color": "coral"
    }
  ],
  [
    "events",
    "2024-09-24:3",
    {
      "id": 3,
      "time": "16:00",
      "title": "Send October invoices",
      "color": "gold"
    }
  ],
  [
    "transactions",
    "1",
    {
      "id": 1,
      "name": "Northstar Studio",
      "amount": 2400,
      "type": "income",
      "category": "Income"
    }
  ],
  [
    "transactions",
    "2",
    {
      "id": 2,
      "name": "Apartment rent",
      "amount": 820,
      "type": "expense",
      "category": "Home"
    }
  ],
  [
    "transactions",
    "3",
    {
      "id": 3,
      "name": "Grocery market",
      "amount": 64.3,
      "type": "expense",
      "category": "Food"
    }
  ],
  [
    "tasks",
    "1",
    {
      "id": 1,
      "title": "Prepare client presentation",
      "detail": "Today · High priority",
      "done": false
    }
  ],
  [
    "tasks",
    "2",
    {
      "id": 2,
      "title": "Review monthly budget",
      "detail": "Sep 20 · Medium priority",
      "done": true
    }
  ],
  [
    "habits",
    "1",
    {
      "id": 1,
      "title": "Drink 8 glasses of water",
      "detail": "12 day streak",
      "done": true
    }
  ],
  [
    "habits",
    "2",
    {
      "id": 2,
      "title": "Read for 30 minutes",
      "detail": "8 day streak",
      "done": false
    }
  ],
  [
    "goals",
    "1",
    {
      "id": 1,
      "title": "Build emergency fund",
      "detail": "72% complete",
      "progress": 72
    }
  ],
  [
    "goals",
    "2",
    {
      "id": 2,
      "title": "Run a half marathon",
      "detail": "45% complete",
      "progress": 45
    }
  ],
  [
    "fitness",
    "1",
    {
      "id": 1,
      "title": "Upper body workout",
      "detail": "45 min · 8 exercises",
      "done": true
    }
  ],
  [
    "fitness",
    "2",
    {
      "id": 2,
      "title": "Morning run",
      "detail": "5.2 km · 31 min",
      "done": true
    }
  ],
  [
    "notes",
    "1",
    {
      "id": 1,
      "title": "Product ideas",
      "detail": "Explore a weekly review feature"
    }
  ],
  [
    "notes",
    "2",
    {
      "id": 2,
      "title": "September reflection",
      "detail": "Consistency improved this month"
    }
  ]
];
      for (const [module, id, payload] of samples) {
        await client.query('DELETE FROM module_records WHERE user_id = $1 AND module = $2 AND record_id = $3 AND payload = $4::jsonb', ['demo-user', module, id, JSON.stringify(payload)]);
      }
      await client.query("INSERT INTO module_records (user_id, module, record_id, payload, addtime, updatetime) SELECT 'local-user', module, record_id, payload, addtime, updatetime FROM module_records WHERE user_id = 'demo-user'");
      await client.query("DELETE FROM users WHERE id = 'demo-user'");
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

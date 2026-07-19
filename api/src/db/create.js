require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../lib/db');

async function create() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Schema created successfully');
  await db.pool.end();
}

create().catch((err) => {
  console.error('Failed to create schema:', err);
  process.exit(1);
});

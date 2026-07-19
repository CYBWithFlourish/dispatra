require('dotenv').config();
const db = require('../lib/db');

async function drop() {
  await db.query('DROP TABLE IF EXISTS transactions CASCADE');
  await db.query('DROP TABLE IF EXISTS jobs CASCADE');
  await db.query('DROP TABLE IF EXISTS riders CASCADE');
  await db.query('DROP TABLE IF EXISTS users CASCADE');
  console.log('All tables dropped');
  await db.pool.end();
}

drop().catch((err) => {
  console.error('Failed to drop tables:', err);
  process.exit(1);
});

require('dotenv').config();
const db = require('../lib/db');

const DEMO_USERS = [
  { wallet_address: '0xC396caB081dAb1E2d1561Af4f33B25d035C0FD29', name: 'Deployer', role: 'both' },
  { wallet_address: '0x0000000000000000000000000000000000000001', name: 'Alice (Sender)', role: 'sender' },
  { wallet_address: '0x0000000000000000000000000000000000000002', name: 'Bob (Rider)', role: 'rider' },
];

const DEMO_RIDERS = [
  { wallet_address: '0xC396caB081dAb1E2d1561Af4f33B25d035C0FD29', vehicle_type: 'motorcycle' },
  { wallet_address: '0x0000000000000000000000000000000000000002', vehicle_type: 'bicycle' },
];

const DEMO_JOBS = [
  {
    job_id: 0,
    sender: '0x0000000000000000000000000000000000000001',
    recipient: '0x0000000000000000000000000000000000000003',
    rider: '0x0000000000000000000000000000000000000002',
    amount: '0.988',
    pickup_location: 'Mon HQ, San Francisco',
    delivery_location: '123 Main St, Oakland',
    status: 'completed',
  },
  {
    job_id: 1,
    sender: '0x0000000000000000000000000000000000000001',
    recipient: '0x0000000000000000000000000000000000000004',
    rider: null,
    amount: '2.50',
    pickup_location: 'Coffee Shop, Downtown',
    delivery_location: '456 Oak Ave, Berkeley',
    status: 'created',
  },
];

async function seed() {
  for (const user of DEMO_USERS) {
    await db.query(
      `INSERT INTO users (wallet_address, name, role) VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address) DO UPDATE SET name = $2, role = $3`,
      [user.wallet_address, user.name, user.role]
    );
  }
  console.log('Seeded users');

  for (const rider of DEMO_RIDERS) {
    await db.query(
      `INSERT INTO riders (wallet_address, vehicle_type) VALUES ($1, $2)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [rider.wallet_address, rider.vehicle_type]
    );
  }
  console.log('Seeded riders');

  for (const job of DEMO_JOBS) {
    await db.query(
      `INSERT INTO jobs (job_id, sender, recipient, rider, amount, pickup_location, delivery_location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (job_id) DO NOTHING`,
      [job.job_id, job.sender, job.recipient, job.rider, job.amount, job.pickup_location, job.delivery_location, job.status]
    );
  }
  console.log('Seeded jobs');

  await db.pool.end();
}

seed().catch((err) => {
  console.error('Failed to seed:', err);
  process.exit(1);
});

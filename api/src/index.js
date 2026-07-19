require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const db = require('./lib/db');
const { setupWebSocket } = require('./lib/websocket');
const { setupWorkers } = require('./lib/queue');
const { getClient } = require('./lib/redis');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const riderRoutes = require('./routes/riders');
const userRoutes = require('./routes/users');
const kycRoutes = require('./routes/kyc');

const app = express();
const server = http.createServer(app);
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4321', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/riders', riderRoutes);
app.use('/users', userRoutes);
app.use('/kyc', kycRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Dispatra API',
    version: '3.0.0',
    network: process.env.MONAD_RPC_URL?.includes('testnet') ? 'testnet' : 'mainnet',
    features: ['encrypted-locations', 'redis-cache', 'websocket', 'bullmq', 'siwe-auth', 'jwt', 'sumsub-kyc'],
  });
});

async function initDatabase() {
  const skipInit = process.env.AUTO_INIT_DB === 'false';
  if (skipInit) {
    console.log('[DB] AUTO_INIT_DB=false — skipping auto-init');
    return;
  }

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await db.query(schema);
    console.log('[DB] Schema initialized');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('[DB] PostgreSQL not available — running without database');
    } else {
      console.error('[DB] Schema init error:', err.message);
    }
  }
}

async function connectRedis() {
  const redis = getClient();
  if (!redis) {
    console.log('[Redis] No REDIS_URL — running without cache/queues');
    return;
  }
  try {
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    console.log('[Redis] Connected');
    setupWorkers();
  } catch {
    console.log('[Redis] Not available — running without cache/queues');
  }
}

async function start() {
  await initDatabase();
  await connectRedis();

  setupWebSocket(server);

  server.listen(PORT, HOST, () => {
    console.log(`Dispatra API running on http://${HOST}:${PORT}`);
    console.log(`WebSocket available at ws://${HOST}:${PORT}/ws`);
    console.log(`Database auto-init: ${process.env.AUTO_INIT_DB === 'false' ? 'disabled' : 'enabled'}`);
  });
}

start();

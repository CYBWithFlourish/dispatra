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
const { logger, logStartup, logRedis, logDB } = require('./lib/logger');

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

app.use(logger);
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
    logDB('AUTO_INIT_DB=false — skipping auto-init', false);
    return;
  }

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await db.query(schema);
    logDB('Schema initialized');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      logDB('PostgreSQL not available — running without database', false);
    } else {
      logDB(`Schema init error: ${err.message}`, false);
    }
  }
}

async function connectRedis() {
  const redis = getClient();
  if (!redis) {
    logRedis('No REDIS_URL — running without cache/queues', false);
    return;
  }
  try {
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    logRedis('Cache and queues ready');
    setupWorkers();
  } catch {
    logRedis('Not available — running without cache/queues', false);
  }
}

async function start() {
  logStartup('Starting Dispatra API...');
  await initDatabase();
  await connectRedis();

  setupWebSocket(server);

  server.listen(PORT, HOST, () => {
    logStartup(`API listening on http://${HOST}:${PORT}`);
    logStartup(`WebSocket at ws://${HOST}:${PORT}/ws`);
    logStartup(`Auto-init DB: ${process.env.AUTO_INIT_DB === 'false' ? 'disabled' : 'enabled'}`);
    logStartup(`Network: ${process.env.MONAD_RPC_URL?.includes('testnet') ? 'testnet' : 'mainnet'}`);
  });
}

start();

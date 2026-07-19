const Redis = require('ioredis');

let client;
let subscriber;

function getClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED') console.error('Redis error:', err.message);
    });
  }
  return client;
}

function getSubscriber() {
  if (!subscriber) {
    subscriber = getClient().duplicate();
  }
  return subscriber;
}

async function cacheGet(key) {
  try {
    const redis = getClient();
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 30) {
  try {
    const redis = getClient();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { }
}

async function cacheDel(key) {
  try {
    const redis = getClient();
    await redis.del(key);
  } catch { }
}

async function publishEvent(channel, data) {
  try {
    const redis = getClient();
    await redis.publish(channel, JSON.stringify(data));
  } catch { }
}

const NONCE_TTL = 300;

async function setNonce(address, nonce) {
  try {
    const redis = getClient();
    await redis.set(`nonce:${address.toLowerCase()}`, nonce, 'EX', NONCE_TTL);
  } catch { }
}

async function getNonce(address) {
  try {
    const redis = getClient();
    return await redis.get(`nonce:${address.toLowerCase()}`);
  } catch { return null; }
}

async function deleteNonce(address) {
  try {
    const redis = getClient();
    await redis.del(`nonce:${address.toLowerCase()}`);
  } catch { }
}

module.exports = { getClient, getSubscriber, cacheGet, cacheSet, cacheDel, publishEvent, setNonce, getNonce, deleteNonce };

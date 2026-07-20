const Redis = require('ioredis');

let client;
let subscriber;
let redisAvailable = false;

function getClient() {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) return null;
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: true,
      maxLoadingTimeout: 5000,
    });
    client.on('error', () => {});
    client.on('ready', () => { redisAvailable = true; });
  }
  return client;
}

function getSubscriber() {
  if (!redisAvailable) return null;
  if (!subscriber) {
    const c = getClient();
    if (c) subscriber = c.duplicate({ enableOfflineQueue: true });
  }
  return subscriber;
}

async function cacheGet(key) {
  if (!redisAvailable) return null;
  try {
    const val = await getClient()?.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 30) {
  if (!redisAvailable) return;
  try {
    await getClient()?.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { }
}

async function cacheDel(key) {
  if (!redisAvailable) return;
  try {
    await getClient()?.del(key);
  } catch { }
}

async function publishEvent(channel, data) {
  if (!redisAvailable) return;
  try {
    await getClient()?.publish(channel, JSON.stringify(data));
  } catch { }
}

const NONCE_TTL = 300;
const memoryNonces = new Map();

async function setNonce(address, nonce) {
  const key = address.toLowerCase();
  if (!redisAvailable) {
    memoryNonces.set(key, { nonce, expires: Date.now() + NONCE_TTL * 1000 });
    return;
  }
  try {
    await getClient()?.set(`nonce:${key}`, nonce, 'EX', NONCE_TTL);
  } catch { }
}

async function getNonce(address) {
  const key = address.toLowerCase();
  if (!redisAvailable) {
    const entry = memoryNonces.get(key);
    if (!entry || Date.now() > entry.expires) {
      memoryNonces.delete(key);
      return null;
    }
    return entry.nonce;
  }
  try {
    return await getClient()?.get(`nonce:${key}`);
  } catch { return null; }
}

async function deleteNonce(address) {
  const key = address.toLowerCase();
  memoryNonces.delete(key);
  if (!redisAvailable) return;
  try {
    await getClient()?.del(`nonce:${key}`);
  } catch { }
}

module.exports = { getClient, getSubscriber, cacheGet, cacheSet, cacheDel, publishEvent, setNonce, getNonce, deleteNonce };

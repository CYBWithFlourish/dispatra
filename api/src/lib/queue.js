const { Queue, Worker } = require('bullmq');
const { getClient } = require('./redis');

const connection = getClient();

const syncQueue = new Queue('sync-events', { connection: process.env.REDIS_URL });
const notifyQueue = new Queue('notifications', { connection: process.env.REDIS_URL });

function setupWorkers() {
  const syncWorker = new Worker('sync-events', async (job) => {
    console.log(`[BullMQ] Syncing job ${job.data.jobId}`);
  }, { connection: process.env.REDIS_URL });

  const notifyWorker = new Worker('notifications', async (job) => {
    console.log(`[BullMQ] Notifying riders for job ${job.data.jobId}`);
  }, { connection: process.env.REDIS_URL });

  syncWorker.on('failed', (job, err) => console.error(`[BullMQ] Sync failed:`, err.message));
  notifyWorker.on('failed', (job, err) => console.error(`[BullMQ] Notify failed:`, err.message));

  return { syncWorker, notifyWorker };
}

module.exports = { syncQueue, notifyQueue, setupWorkers };

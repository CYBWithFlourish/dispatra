const { Queue, Worker } = require('bullmq');

let syncQueue;
let notifyQueue;

function getQueues() {
  if (!process.env.REDIS_URL) return null;
  if (!syncQueue) {
    const connection = process.env.REDIS_URL;
    syncQueue = new Queue('sync-events', { connection });
    notifyQueue = new Queue('notifications', { connection });
  }
  return { syncQueue, notifyQueue };
}

function setupWorkers() {
  if (!process.env.REDIS_URL) return;

  const connection = process.env.REDIS_URL;

  const syncWorker = new Worker('sync-events', async (job) => {
    console.log(`[BullMQ] Syncing job ${job.data.jobId}`);
  }, { connection });

  const notifyWorker = new Worker('notifications', async (job) => {
    console.log(`[BullMQ] Notifying riders for job ${job.data.jobId}`);
  }, { connection });

  syncWorker.on('failed', (job, err) => console.error(`[BullMQ] Sync failed:`, err.message));
  notifyWorker.on('failed', (job, err) => console.error(`[BullMQ] Notify failed:`, err.message));

  return { syncWorker, notifyWorker };
}

module.exports = { getQueues, setupWorkers };

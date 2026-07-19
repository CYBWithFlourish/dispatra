const express = require('express');
const db = require('../lib/db');
const { getJobFromChain, getJobCounter } = require('../lib/contract');
const { encrypt, decrypt, hashLocation } = require('../lib/encryption');
const { cacheGet, cacheSet, cacheDel, publishEvent } = require('../lib/redis');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, rider, sender, limit = 50, offset = 0 } = req.query;
    const cacheKey = `jobs:${status || 'all'}:${rider || ''}:${sender || ''}:${limit}:${offset}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (rider) {
      query += ` AND LOWER(rider) = LOWER($${paramIdx++})`;
      params.push(rider);
    }
    if (sender) {
      query += ` AND LOWER(sender) = LOWER($${paramIdx++})`;
      params.push(sender);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    const response = { jobs: result.rows, total: result.rowCount };
    await cacheSet(cacheKey, response, 30);
    res.json(response);
  } catch (err) {
    console.error('Error listing jobs:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM jobs WHERE job_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    if (job.encrypted_pickup_location && job.location_salt) {
      try {
        const salt = JSON.parse(job.location_salt);
        job.pickup_location = decrypt(job.encrypted_pickup_location, salt.pickupIv, salt.pickupAuthTag);
        job.delivery_location = decrypt(job.encrypted_delivery_location, salt.deliveryIv, salt.deliveryAuthTag);
      } catch { }
    }

    res.json(job);
  } catch (err) {
    console.error('Error getting job:', err);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

router.get('/:id/pin', async (req, res) => {
  try {
    const chainJob = await getJobFromChain(req.params.id);
    if (!chainJob.pin) {
      return res.status(404).json({ error: 'PIN not found' });
    }
    res.json({ jobId: chainJob.jobId, pin: chainJob.pin });
  } catch (err) {
    console.error('Error getting PIN:', err);
    res.status(500).json({ error: 'Failed to get PIN' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { job_id, pickup_location, delivery_location } = req.body;
    if (job_id === undefined || !pickup_location || !delivery_location) {
      return res.status(400).json({ error: 'job_id, pickup_location, delivery_location required' });
    }

    const pickupEnc = encrypt(pickup_location);
    const deliveryEnc = encrypt(delivery_location);
    const pickupHash = hashLocation(pickupEnc.ciphertext);
    const deliveryHash = hashLocation(deliveryEnc.ciphertext);

    const salt = JSON.stringify({
      pickupIv: pickupEnc.iv,
      pickupAuthTag: pickupEnc.authTag,
      deliveryIv: deliveryEnc.iv,
      deliveryAuthTag: deliveryEnc.authTag,
    });

    const chainJob = await getJobFromChain(job_id);

    const result = await db.query(
      `INSERT INTO jobs (job_id, sender, recipient, rider, amount, status, token, deadline,
         encrypted_pickup_location, encrypted_delivery_location, location_salt,
         pickup_location_hash, delivery_location_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (job_id) DO UPDATE SET
         encrypted_pickup_location = $9, encrypted_delivery_location = $10,
         location_salt = $11, pickup_location_hash = $12, delivery_location_hash = $13,
         updated_at = NOW()
       RETURNING *`,
      [job_id, chainJob.sender, chainJob.recipient, chainJob.rider || null,
       chainJob.amount, chainJob.status, chainJob.token, chainJob.deadline,
       pickupEnc.ciphertext, deliveryEnc.ciphertext, salt,
       `0x${pickupHash}`, `0x${deliveryHash}`]
    );

    await cacheDel('jobs:all::50:0');
    await publishEvent('job:created', { jobId: job_id, pickup: pickup_location, delivery: delivery_location });

    const job = result.rows[0];
    job.pickup_location = pickup_location;
    job.delivery_location = delivery_location;
    res.json(job);
  } catch (err) {
    console.error('Error creating job with locations:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { jobId } = req.body;
    if (jobId === undefined) {
      return res.status(400).json({ error: 'jobId required' });
    }

    const chainJob = await getJobFromChain(jobId);
    const result = await db.query(
      `INSERT INTO jobs (job_id, sender, recipient, rider, amount, status, token, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (job_id) DO UPDATE SET
         sender = $2, recipient = $3, rider = $4, amount = $5,
         status = $6, token = $7, deadline = $8, updated_at = NOW()
       RETURNING *`,
      [chainJob.jobId, chainJob.sender, chainJob.recipient, chainJob.rider || null,
       chainJob.amount, chainJob.status, chainJob.token, chainJob.deadline]
    );

    await cacheDel('jobs:all::50:0');
    res.json({ ...result.rows[0], pin: chainJob.pin });
  } catch (err) {
    console.error('Error syncing job:', err);
    res.status(500).json({ error: 'Failed to sync job' });
  }
});

router.post('/sync-all', async (req, res) => {
  try {
    const count = await getJobCounter();
    const synced = [];

    for (let i = 0; i < count; i++) {
      try {
        const chainJob = await getJobFromChain(i);
        const result = await db.query(
          `INSERT INTO jobs (job_id, sender, recipient, rider, amount, status, token, deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (job_id) DO UPDATE SET
             sender = $2, recipient = $3, rider = $4, amount = $5,
             status = $6, token = $7, deadline = $8, updated_at = NOW()
           RETURNING *`,
          [chainJob.jobId, chainJob.sender, chainJob.recipient, chainJob.rider || null,
           chainJob.amount, chainJob.status, chainJob.token, chainJob.deadline]
        );
        synced.push({ ...result.rows[0], pin: chainJob.pin });
      } catch (jobErr) {
        console.error(`Failed to sync job ${i}:`, jobErr.message);
      }
    }

    await cacheDel('jobs:all::50:0');
    res.json({ synced: synced.length, total: count });
  } catch (err) {
    console.error('Error syncing all jobs:', err);
    res.status(500).json({ error: 'Failed to sync jobs' });
  }
});

module.exports = router;

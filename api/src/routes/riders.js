const express = require('express');
const db = require('../lib/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await db.query('SELECT * FROM riders WHERE LOWER(wallet_address) = LOWER($1)', [address]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting rider:', err);
    res.status(500).json({ error: 'Failed to get rider' });
  }
});

router.put('/:address', authMiddleware, async (req, res) => {
  try {
    const { address } = req.params;

    if (req.walletAddress !== address.toLowerCase()) {
      return res.status(403).json({ error: 'Can only update your own profile' });
    }

    const { vehicle_type } = req.body;

    await db.query(
      `INSERT INTO users (wallet_address, role) VALUES ($1, 'rider')
       ON CONFLICT (wallet_address) DO UPDATE SET role = 'rider'`,
      [address]
    );

    const result = await db.query(
      `INSERT INTO riders (wallet_address, vehicle_type) VALUES ($1, $2)
       ON CONFLICT (wallet_address) DO UPDATE SET vehicle_type = $2, is_active = true
       RETURNING *`,
      [address, vehicle_type || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating rider:', err);
    res.status(500).json({ error: 'Failed to update rider' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { active, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM riders WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (active !== undefined) {
      query += ` AND is_active = $${paramIdx++}`;
      params.push(active === 'true');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    res.json({ riders: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('Error listing riders:', err);
    res.status(500).json({ error: 'Failed to list riders' });
  }
});

module.exports = router;

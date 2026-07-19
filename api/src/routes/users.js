const express = require('express');
const db = require('../lib/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await db.query(
      'SELECT wallet_address, name, phone, role, kyc_status, created_at FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [address]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting user:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.put('/:address', authMiddleware, async (req, res) => {
  try {
    const { address } = req.params;

    if (req.walletAddress !== address.toLowerCase()) {
      return res.status(403).json({ error: 'Can only update your own profile' });
    }

    const { name, phone, role } = req.body;

    const result = await db.query(
      `INSERT INTO users (wallet_address, name, phone, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (wallet_address) DO UPDATE SET
         name = COALESCE($2, users.name),
         phone = COALESCE($3, users.phone),
         role = COALESCE($4, users.role)
       RETURNING wallet_address, name, phone, role, kyc_status, created_at`,
      [address.toLowerCase(), name || null, phone || null, role || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;

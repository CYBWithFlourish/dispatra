const express = require('express');
const db = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Database connection failed' });
  }
});

module.exports = router;

const express = require('express');
const db = require('../lib/db');
const { generateNonce, createJWT, verifySiwe, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/nonce', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const nonce = generateNonce();
    const redis = require('../lib/redis');
    await redis.setNonce(address.toLowerCase(), nonce);

    res.json({ nonce, statement: 'Sign in to Dispatra' });
  } catch (err) {
    console.error('Auth nonce error:', err);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature required' });
    }

    const verified = await verifySiwe(address, signature);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const existing = await db.query(
      'SELECT role, kyc_status, wallet_verified FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [address]
    );

    const role = existing.rows[0]?.role || 'sender';

    if (existing.rows.length === 0) {
      await db.query(
        'INSERT INTO users (wallet_address, role) VALUES ($1, $2) ON CONFLICT (wallet_address) DO NOTHING',
        [address.toLowerCase(), role]
      );
    }

    const token = createJWT(address, role);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token, address: address.toLowerCase(), role, walletVerified: existing.rows[0]?.wallet_verified || false, kycStatus: existing.rows[0]?.kyc_status || 'none', kycLevel: existing.rows[0]?.kyc_level || 'none' });
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/verify-wallet', authMiddleware, async (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature required' });
    }

    const verified = await verifySiwe(address, signature);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    await db.query(
      'UPDATE users SET wallet_verified = true WHERE LOWER(wallet_address) = LOWER($1)',
      [address.toLowerCase()]
    );

    res.json({ walletVerified: true });
  } catch (err) {
    console.error('Verify wallet error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT wallet_address, name, phone, role, wallet_verified, kyc_status, kyc_level, created_at FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [req.walletAddress]
    );

    if (result.rows.length === 0) {
      return res.json({ address: req.walletAddress, role: req.userRole });
    }

    const user = result.rows[0];
    res.json({
      address: user.wallet_address,
      name: user.name,
      phone: user.phone,
      role: user.role,
      walletVerified: user.wallet_verified,
      kycStatus: user.kyc_status,
      kycLevel: user.kyc_level || 'none',
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;

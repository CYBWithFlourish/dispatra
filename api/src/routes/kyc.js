const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || '';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

function sumsubHeaders(method, path, body = '') {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(ts + method.toUpperCase() + path + body)
    .digest('hex');

  return {
    'X-App-Token': SUMSUB_APP_TOKEN,
    'X-App-Access-Sig': signature,
    'X-App-Access-Ts': ts,
    'Content-Type': 'application/json',
  };
}

function kycLevelForRole(role) {
  if (role === 'rider') return 'nin-and-license';
  return 'national-id';
}

const KYC_LEVEL_ORDER = { 'none': 0, 'national-id': 1, 'nin-and-license': 2 };

function isLevelSufficient(currentLevel, requiredLevel) {
  return (KYC_LEVEL_ORDER[currentLevel] || 0) >= (KYC_LEVEL_ORDER[requiredLevel] || 0);
}

router.get('/test', async (_req, res) => {
  res.json({
    configured: !!(SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY),
    baseUrl: SUMSUB_BASE_URL,
  });
});

router.post('/create-applicant', authMiddleware, async (req, res) => {
  try {
    const address = req.walletAddress;
    const role = req.body.role || 'sender';
    const levelId = kycLevelForRole(role);

    if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
      return res.status(503).json({ error: 'KYC provider not configured' });
    }

    const existing = await db.query(
      'SELECT kyc_status, kyc_level, kyc_applicant_id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [address]
    );

    const user = existing.rows[0];
    const currentLevel = user?.kyc_level || 'none';
    const currentStatus = user?.kyc_status || 'none';

    if (currentStatus === 'verified' && isLevelSufficient(currentLevel, levelId)) {
      return res.json({
        applicantId: user.kyc_applicant_id,
        levelId: currentLevel,
        alreadyVerified: true,
        message: `Already verified at ${currentLevel} level`,
      });
    }

    if (currentStatus === 'pending') {
      return res.json({
        applicantId: user.kyc_applicant_id,
        levelId: currentLevel,
        alreadyPending: true,
        message: 'Verification already in progress',
      });
    }

    const externalId = address.toLowerCase();
    const bodyObj = { externalUserId: externalId };
    const body = JSON.stringify(bodyObj);
    const path = `/resources/applicants?levelName=${encodeURIComponent(levelId)}`;

    const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      method: 'POST',
      headers: sumsubHeaders('POST', path, body),
      body,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Sumsub create applicant error:', err);
      return res.status(502).json({ error: 'Failed to create KYC applicant' });
    }

    const data = await response.json();

    await db.query(
      `UPDATE users SET kyc_status = 'pending', kyc_level = $1, kyc_applicant_id = $2 WHERE LOWER(wallet_address) = LOWER($3)`,
      [levelId, data.id, address]
    );

    res.json({ applicantId: data.id, levelId, upgraded: currentLevel !== 'none' && currentLevel !== levelId });
  } catch (err) {
    console.error('KYC create-applicant error:', err);
    res.status(500).json({ error: 'Failed to create KYC applicant' });
  }
});

router.get('/status/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    const result = await db.query(
      'SELECT wallet_verified, kyc_status, kyc_level, kyc_applicant_id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [address]
    );

    if (result.rows.length === 0) {
      return res.json({
        walletVerified: false,
        status: 'none',
        level: 'none',
        applicantId: null,
        verified: false,
      });
    }

    const user = result.rows[0];

    if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY || !user.kyc_applicant_id) {
      return res.json({
        walletVerified: user.wallet_verified || false,
        status: user.kyc_status,
        level: user.kyc_level || 'none',
        applicantId: user.kyc_applicant_id,
        verified: user.kyc_status === 'verified',
      });
    }

    const path = `/resources/applicants/${user.kyc_applicant_id}/status`;
    const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      headers: sumsubHeaders('GET', path),
    });

    if (response.ok) {
      const data = await response.json();
      const reviewResult = data.reviewResult?.reviewAnswer;
      const newStatus = reviewResult === 'GREEN' ? 'verified' : reviewResult === 'RED' ? 'rejected' : 'pending';

      if (newStatus !== user.kyc_status) {
        await db.query(
          'UPDATE users SET kyc_status = $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [newStatus, address]
        );
      }

      return res.json({
        walletVerified: user.wallet_verified || false,
        status: newStatus,
        level: user.kyc_level || 'none',
        applicantId: user.kyc_applicant_id,
        verified: newStatus === 'verified',
        reviewAnswer: reviewResult,
      });
    }

    res.json({
      walletVerified: user.wallet_verified || false,
      status: user.kyc_status,
      applicantId: user.kyc_applicant_id,
      verified: user.kyc_status === 'verified',
    });
  } catch (err) {
    console.error('KYC status error:', err);
    res.status(500).json({ error: 'Failed to check KYC status' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-payload-signature'];
    const body = req.body.toString();

    if (SUMSUB_SECRET_KEY) {
      const expected = crypto.createHmac('sha1', SUMSUB_SECRET_KEY).update(body).digest('hex');
      if (signature !== expected) {
        console.warn('Sumsub webhook signature mismatch');
      }
    }

    const payload = JSON.parse(body);
    const { externalUserId, reviewResult, type } = payload;

    if (type === 'applicantReviewed' && externalUserId) {
      const newStatus = reviewResult?.reviewAnswer === 'GREEN' ? 'verified' : 'rejected';

      await db.query(
        'UPDATE users SET kyc_status = $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [newStatus, externalUserId]
      );

      console.log(`[KYC] ${externalUserId} -> ${newStatus}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('KYC webhook error:', err);
    res.status(200).json({ ok: true });
  }
});

router.get('/token/:address', authMiddleware, async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    if (req.walletAddress !== address) {
      return res.status(403).json({ error: 'Can only get your own token' });
    }

    if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
      return res.status(503).json({ error: 'KYC provider not configured' });
    }

    const result = await db.query(
      'SELECT kyc_applicant_id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [address]
    );

    if (result.rows.length === 0 || !result.rows[0].kyc_applicant_id) {
      return res.status(404).json({ error: 'No KYC applicant found' });
    }

    const path = '/resources/accessTokens/sdk';
    const bodyObj = {
      userId: address,
      levelName: kycLevelForRole(req.userRole || 'sender'),
      ttlInSecs: 600,
    };
    const body = JSON.stringify(bodyObj);

    const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      method: 'POST',
      headers: sumsubHeaders('POST', path, body),
      body,
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to get Sumsub token' });
    }

    const data = await response.json();
    res.json({ token: data.token });
  } catch (err) {
    console.error('KYC token error:', err);
    res.status(500).json({ error: 'Failed to get KYC token' });
  }
});

module.exports = router;

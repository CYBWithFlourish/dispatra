const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { SiweMessage } = require('siwe');

const JWT_SECRET = process.env.JWT_SECRET || 'dispatra-dev-secret';
const JWT_EXPIRES = '7d';

function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function createJWT(address, role) {
  return jwt.sign({ address: address.toLowerCase(), role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function verifySiwe(address, signature) {
  try {
    const nonce = await require('../lib/redis').getNonce(address.toLowerCase());
    if (!nonce) return null;

    const message = new SiweMessage({
      domain: process.env.API_HOST || 'localhost:3001',
      address,
      statement: 'Sign in to Dispatra',
      uri: `http://${process.env.API_HOST || 'localhost:3001'}`,
      version: '1',
      chainId: 10143,
      nonce,
    });

    const { data: fields } = await message.verify({ signature });
    await require('../lib/redis').deleteNonce(address.toLowerCase());
    return fields.address.toLowerCase();
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.walletAddress = payload.address;
  req.userRole = payload.role;
  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    const payload = verifyJWT(token);
    if (payload) {
      req.walletAddress = payload.address;
      req.userRole = payload.role;
    }
  }

  next();
}

module.exports = { generateNonce, createJWT, verifyJWT, verifySiwe, authMiddleware, optionalAuth };

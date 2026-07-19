const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.LOCATION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');

if (KEY.length !== 32) {
  throw new Error('LOCATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decrypt(ciphertext, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function hashLocation(ciphertext) {
  return crypto.createHash('sha256').update(ciphertext).digest('hex');
}

module.exports = { encrypt, decrypt, hashLocation };

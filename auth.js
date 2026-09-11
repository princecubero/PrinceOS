const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return { salt, hash: derived.toString('hex') };
}

async function verifyPassword(password, salt, expectedHex) {
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(derived, Buffer.from(expectedHex, 'hex'));
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

module.exports = { hashPassword, verifyPassword, newSessionToken, hashToken };

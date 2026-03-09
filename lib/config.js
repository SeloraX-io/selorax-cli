'use strict';

const fs = require('fs');
const path = require('path');
const Conf = require('conf');

// Persistent credentials store (~/.config/selorax-cli/config.json)
const store = new Conf({
  projectName: 'selorax-cli',
  schema: {
    clientId: { type: 'string', default: '' },
    clientSecret: { type: 'string', default: '' },
    storeId: { type: 'string', default: '' },
    apiUrl: { type: 'string', default: 'https://api.selorax.io/api' },
    appName: { type: 'string', default: '' },
  },
});

/**
 * Read selorax.config.json from the current project directory.
 */
function readProjectConfig(configPath) {
  const resolved = path.resolve(process.cwd(), configPath || 'selorax.config.json');

  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${resolved}: ${err.message}`);
  }
}

/**
 * Write selorax.config.json.
 */
function writeProjectConfig(configPath, config) {
  const resolved = path.resolve(process.cwd(), configPath || 'selorax.config.json');
  fs.writeFileSync(resolved, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Get auth headers for API requests.
 */
function getAuthHeaders() {
  const clientId = store.get('clientId');
  const clientSecretRaw = store.get('clientSecret');
  const clientSecret = decodeSecret(clientSecretRaw);
  const storeId = store.get('storeId');

  if (!clientId || !clientSecret) {
    throw new Error('Not authenticated. Run: selorax auth:login');
  }

  return {
    'X-Client-Id': clientId,
    'X-Client-Secret': clientSecret,
    'X-Store-Id': storeId || '',
    'Content-Type': 'application/json',
  };
}

function getApiUrl() {
  return store.get('apiUrl') || 'https://api.selorax.io/api';
}

// ── Secret obfuscation (base64) ──────────────────────────────────────────
function encodeSecret(secret) {
  if (!secret) return '';
  return Buffer.from(secret).toString('base64');
}

function decodeSecret(encoded) {
  if (!encoded) return '';
  try { return Buffer.from(encoded, 'base64').toString('utf8'); }
  catch { return encoded; }
}

function getClientSecret() {
  const encoded = store.get('clientSecret');
  return decodeSecret(encoded);
}

function setClientSecret(secret) {
  store.set('clientSecret', encodeSecret(secret));
}

module.exports = {
  store,
  readProjectConfig,
  writeProjectConfig,
  getAuthHeaders,
  getApiUrl,
  getClientSecret,
  setClientSecret,
};

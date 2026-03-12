'use strict';

const https = require('https');
const http = require('http');
const { getAuthHeaders, getApiUrl } = require('./config');

/**
 * Make an HTTP request to the SeloraX API.
 */
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const baseUrl = getApiUrl();
    const url = new URL(path.startsWith('/') ? path : '/' + path, baseUrl);
    const headers = getAuthHeaders();

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
        timeout: 30000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(parsed.message || `HTTP ${res.statusCode}`);
              err.status = res.statusCode;
              err.data = parsed;
              reject(err);
            } else {
              resolve(parsed);
            }
          } catch {
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            } else {
              resolve(data);
            }
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

const del = (path) => request('DELETE', path);

module.exports = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del,
  'delete': del,
};

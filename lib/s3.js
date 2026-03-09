'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Minimal S3-compatible uploader for Cloudflare R2.
 * No AWS SDK dependency — uses raw HTTP with AWS Signature V4.
 */

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  let key = hmacSha256('AWS4' + secretKey, dateStamp);
  key = hmacSha256(key, region);
  key = hmacSha256(key, service);
  key = hmacSha256(key, 'aws4_request');
  return key;
}

/**
 * Upload a file to S3/R2.
 * @param {object} opts
 * @param {string} opts.endpoint — S3 endpoint URL (e.g. https://xxx.r2.cloudflarestorage.com)
 * @param {string} opts.bucket — Bucket name
 * @param {string} opts.accessKey — Access key
 * @param {string} opts.secretKey — Secret key
 * @param {string} opts.key — Object key (path in bucket)
 * @param {Buffer|string} opts.body — File contents
 * @param {string} [opts.contentType] — MIME type
 * @param {string} [opts.cacheControl] — Cache-Control header
 */
function uploadToS3(opts) {
  return new Promise((resolve, reject) => {
    const body = typeof opts.body === 'string' ? Buffer.from(opts.body) : opts.body;
    const url = new URL(opts.endpoint);
    const region = 'auto'; // R2 uses 'auto'
    const service = 's3';
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const contentHash = sha256(body);
    const contentType = opts.contentType || 'application/javascript';

    const pathname = `/${opts.bucket}/${opts.key}`;
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${url.hostname}\n` +
      `x-amz-content-sha256:${contentHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      pathname,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      contentHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(opts.secretKey, dateStamp, region, service);
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    };

    if (opts.cacheControl) {
      headers['Cache-Control'] = opts.cacheControl;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: pathname,
        method: 'PUT',
        headers,
        timeout: 30000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: res.statusCode,
              key: opts.key,
              url: `${opts.publicUrl || opts.endpoint}/${opts.key}`,
            });
          } else {
            reject(new Error(`S3 upload failed (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('S3 upload timed out'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Upload an extension bundle to the SeloraX assets CDN.
 * @param {object} s3Config — { endpoint, bucket, accessKey, secretKey, publicUrl }
 * @param {string} appId — App identifier
 * @param {string} extensionId — Extension identifier
 * @param {string} filePath — Local file path to the built bundle
 * @returns {Promise<string>} — Public URL
 */
async function uploadExtensionBundle(s3Config, appId, extensionId, filePath) {
  const body = fs.readFileSync(filePath);
  const key = `extensions/${appId}/${extensionId}.js`;

  const result = await uploadToS3({
    endpoint: s3Config.endpoint,
    bucket: s3Config.bucket,
    accessKey: s3Config.accessKey,
    secretKey: s3Config.secretKey,
    publicUrl: s3Config.publicUrl,
    key,
    body,
    contentType: 'application/javascript',
    cacheControl: 'public, max-age=31536000, immutable',
  });

  return `${s3Config.publicUrl}/${key}`;
}

module.exports = {
  uploadToS3,
  uploadExtensionBundle,
};

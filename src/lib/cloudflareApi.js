// src/lib/cloudflareApi.js
// Cloudflare Stream API wrapper — used ONLY by /api server routes.
// Never import this in frontend components (it uses secret env vars).

const CF_BASE = 'https://api.cloudflare.com/client/v4/accounts';

/**
 * Core authenticated request to Cloudflare Stream REST API.
 * Uses Node 18+ native fetch — no external HTTP lib needed.
 */
async function cfRequest(method, path, body = null, query = null) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured in environment');
  }

  let url = `${CF_BASE}/${accountId}/stream${path}`;
  if (query) {
    url += `?${new URLSearchParams(query).toString()}`;
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type':  'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(`CF network error: ${networkErr.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`CF returned non-JSON (HTTP ${response.status})`);
  }

  if (!response.ok || !data.success) {
    const messages = (data.errors || [])
      .map(e => `[${e.code}] ${e.message}`)
      .join(', ') || `HTTP ${response.status}`;
    const err = new Error(`Cloudflare API error: ${messages}`);
    err.cfErrors   = data.errors || [];
    err.httpStatus = response.status;
    throw err;
  }

  return data.result;
}

/**
 * Request a one-time Direct Upload URL from Cloudflare Stream.
 * Frontend uploads the video file directly to this URL (never through your server).
 */
export async function createDirectUploadUrl({
  userId,
  teamId,
  promptId,
  maxSizeBytes,
  expirySeconds = 1800,           // 30 minutes
}) {
  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

  const result = await cfRequest('POST', '/direct_upload', {
    maxDurationSeconds: 3600,
    expiry:             expiresAt,
    meta: {
      userId,
      teamId,
      promptId,
      source: 'prism-app',
    },
    requireSignedURLs: false,      // Phase 6 enables this
  });

  return {
    uploadUrl: result.uploadURL,
    videoId:   result.uid,
    expiresAt,
  };
}

/**
 * Fetch video details — called by webhook handler to get playback URLs.
 */
export async function getVideoDetails(videoId) {
  return cfRequest('GET', `/${videoId}`);
}

/**
 * Delete a video from Cloudflare Stream.
 */
export async function deleteVideo(videoId) {
  await cfRequest('DELETE', `/${videoId}`);
}

/**
 * Generate a signed playback token — Phase 6.
 */
export async function createSignedPlaybackToken(videoId, expirySeconds = 3600) {
  const exp    = Math.floor(Date.now() / 1000) + expirySeconds;
  const result = await cfRequest('POST', `/${videoId}/token`, { exp });
  return result.token;
}

/**
 * Verify a Cloudflare webhook HMAC-SHA256 signature.
 * Signature header format: "time=<epoch>,sig1=<hex>"
 */
export async function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('CLOUDFLARE_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }

  try {
    const parts     = Object.fromEntries(
      signatureHeader.split(',').map(p => p.split('='))
    );
    const timestamp = parts.time;
    const signature = parts.sig1;

    if (!timestamp || !signature) return false;

    // Reject stale webhooks (> 5 minutes old)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
      console.warn('Webhook too old — possible replay attack');
      return false;
    }

    const payload  = `${timestamp}.${rawBody}`;
    const encoder  = new TextEncoder();
    const key      = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf   = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time compare — prevents timing attacks
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;

  } catch (err) {
    console.error('Webhook signature error:', err);
    return false;
  }
}

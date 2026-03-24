import fetch from 'node-fetch';
import https from 'https';
import 'dotenv/config';

// ── TLS ───────────────────────────────────────────────────────────────────────
// SAP_INSECURE=true disables certificate verification for self-signed dev certs.
// Leave unset (or set to false) for production — certificate validation is on by default.
const insecure = process.env.SAP_INSECURE === 'true';
const agent = new https.Agent({ rejectUnauthorized: !insecure });

// ── Connection ────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SAP_URL;
const AUTH     = Buffer.from(`${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`).toString('base64');
const CLIENT   = process.env.SAP_CLIENT;
const TIMEOUT_MS = 30_000; // 30 s — abort hanging requests

const BASE_PATH = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/`;

// ── Structured logging (stderr — stdout is reserved for MCP protocol) ─────────
function log(level, msg, meta = {}) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }));
}

// ── CSRF token cache ──────────────────────────────────────────────────────────
// Tokens are valid for the HTTP session. We cache the token + session cookie so
// each write operation needs only one round trip instead of two.
let _csrfToken    = null;
let _cookieHeader = null;

async function refreshCsrf() {
  log('debug', 'csrf_refresh');
  const res = await fetch(`${BASE_URL}${BASE_PATH}`, {
    method:  'GET',
    headers: {
      'Authorization':  `Basic ${AUTH}`,
      'x-csrf-token':   'fetch',
      'sap-client':     CLIENT
    },
    agent,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  const token = res.headers.get('x-csrf-token');
  if (!token) throw new Error('CSRF token fetch failed — no token in response headers');

  const raw = res.headers.raw?.()['set-cookie'] ?? res.headers.get('set-cookie');
  const cookie = Array.isArray(raw)
    ? raw.map(c => c.split(';')[0]).join('; ')
    : (raw ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');

  _csrfToken    = token;
  _cookieHeader = cookie;
  log('debug', 'csrf_refreshed');
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function s4hGet(path) {
  const url   = `${BASE_URL}${path}`;
  const start = Date.now();
  log('debug', 'odata_get', { url });

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Accept':        'application/json',
        'sap-client':    CLIENT
      },
      agent,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    log('error', 'odata_get_failed', { url, err: err.message, ms: Date.now() - start });
    throw err;
  }

  if (!response.ok) {
    const body = await response.text();
    log('error', 'odata_get_http_error', { url, status: response.status, ms: Date.now() - start });
    // Return a generic error — do not surface raw SAP message body to the caller
    // (it may contain internal system info). Log it; return a safe message.
    throw new Error(`OData GET failed [${response.status}] — see server log for details`);
  }

  log('debug', 'odata_get_ok', { url, ms: Date.now() - start });
  return response.json();
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function s4hPost(path, body) {
  const url   = `${BASE_URL}${path}`;
  const start = Date.now();
  log('debug', 'odata_post', { url });

  // Obtain CSRF token (use cache; refresh if missing or if SAP returns 403)
  if (!_csrfToken) await refreshCsrf();

  const doPost = async () => fetch(url, {
    method:  'POST',
    headers: {
      'Authorization':  `Basic ${AUTH}`,
      'Content-Type':   'application/json',
      'Accept':         'application/json',
      'x-csrf-token':   _csrfToken,
      'sap-client':     CLIENT,
      ...(_cookieHeader ? { 'Cookie': _cookieHeader } : {})
    },
    body:   JSON.stringify(body),
    agent,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  let response;
  try {
    response = await doPost();

    // CSRF token expired — refresh once and retry
    if (response.status === 403) {
      log('warn', 'csrf_expired_retry', { url });
      _csrfToken = null;
      _cookieHeader = null;
      await refreshCsrf();
      response = await doPost();
    }
  } catch (err) {
    log('error', 'odata_post_failed', { url, err: err.message, ms: Date.now() - start });
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    log('error', 'odata_post_http_error', { url, status: response.status, body: text, ms: Date.now() - start });

    // Extract the SAP business error message from the OData V4 error body.
    // RAP surfaces reported[] messages in error.innererror.errordetails[].
    // Only the message string is returned — the raw body stays in the log.
    let sapMessage = null;
    try {
      const errJson = JSON.parse(text);
      const details = errJson?.error?.innererror?.errordetails;
      if (Array.isArray(details) && details.length > 0) {
        sapMessage = details.find(d => d.severity === 'error')?.message ?? details[0]?.message;
      }
      sapMessage = sapMessage ?? errJson?.error?.message ?? null;
    } catch { /* non-JSON body — fall through to generic message */ }

    const msg = sapMessage
      ? `OData POST failed [${response.status}]: ${sapMessage}`
      : `OData POST failed [${response.status}] — see server log for details`;
    throw new Error(msg);
  }

  log('debug', 'odata_post_ok', { url, ms: Date.now() - start });
  // 204 No Content is valid for some actions
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

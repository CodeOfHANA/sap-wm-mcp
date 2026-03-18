import fetch from 'node-fetch';
import https from 'https';
import 'dotenv/config';

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE_URL = process.env.SAP_URL;
const AUTH = Buffer.from(`${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`).toString('base64');
const CLIENT = process.env.SAP_CLIENT;

export async function s4hGet(path) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Accept': 'application/json',
      'sap-client': CLIENT
    },
    agent
  });
  if (!response.ok) {
    throw new Error(`S4H OData error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function s4hPost(path, body) {
  const BASE_PATH = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/`;

  // Fetch CSRF token
  const tokenRes = await fetch(`${BASE_URL}${BASE_PATH}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'x-csrf-token': 'fetch',
      'sap-client': CLIENT
    },
    agent
  });
  const csrfToken = tokenRes.headers.get('x-csrf-token');
  if (!csrfToken) throw new Error('CSRF token fetch failed — no token in response headers');

  // Forward session cookie so the token remains valid for this POST
  const cookies = tokenRes.headers.raw?.()['set-cookie'] ?? tokenRes.headers.get('set-cookie');
  const cookieHeader = Array.isArray(cookies)
    ? cookies.map(c => c.split(';')[0]).join('; ')
    : (cookies ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-csrf-token': csrfToken,
      'sap-client': CLIENT,
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
    },
    body: JSON.stringify(body),
    agent
  });
  if (!response.ok) {
    throw new Error(`S4H OData POST error ${response.status}: ${await response.text()}`);
  }
  // 204 No Content is valid for some actions
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

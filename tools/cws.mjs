#!/usr/bin/env node
/**
 * Chrome Web Store (API v2) helper used by .github/workflows/release.yml. Needs Node 18+, no deps.
 *
 *   node tools/cws.mjs status             read-only: item status (proves the credentials work)
 *   node tools/cws.mjs publish <zip>      upload the zip, wait for it, then publish
 *
 * Env: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID
 * (CWS_EXTENSION_ID defaults to this extension). One-time token setup: tools/get-cws-refresh-token.mjs.
 */
import { readFileSync } from 'node:fs';

const EXTENSION_ID = process.env.CWS_EXTENSION_ID || 'hloidpjbdbbhhkihgeeddnofmpgbffjd';
const need = (name) => {
  const v = process.env[name];
  if (!v) { console.error(`Missing env ${name}`); process.exit(1); }
  return v;
};
const item = `publishers/${need('CWS_PUBLISHER_ID')}/items/${EXTENSION_ID}`;
const API = 'https://chromewebstore.googleapis.com';

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) { console.error(`${init?.method ?? 'GET'} ${url} -> ${res.status}\n${text}`); process.exit(1); }
  return text ? JSON.parse(text) : {};
}

async function accessToken() {
  const body = new URLSearchParams({
    client_id: need('CWS_CLIENT_ID'),
    client_secret: need('CWS_CLIENT_SECRET'),
    refresh_token: need('CWS_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  });
  return (await call('https://oauth2.googleapis.com/token', { method: 'POST', body })).access_token;
}

const [command, zip] = process.argv.slice(2);
const headers = { Authorization: `Bearer ${await accessToken()}` };
const status = () => call(`${API}/v2/${item}:fetchStatus`, { headers });

if (command === 'status') {
  console.log(JSON.stringify(await status(), null, 2));
} else if (command === 'publish' && zip) {
  const upload = await call(`${API}/upload/v2/${item}:upload`, { method: 'POST', headers, body: readFileSync(zip) });
  console.log('upload:', JSON.stringify(upload));
  let state = upload.uploadState;
  for (let i = 0; state === 'IN_PROGRESS' && i < 12; i++) { // large uploads settle asynchronously
    await new Promise((r) => setTimeout(r, 10_000));
    state = (await status()).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') { console.error(`Upload did not succeed: ${state}`); process.exit(1); }
  console.log('publish:', JSON.stringify(await call(`${API}/v2/${item}:publish`, { method: 'POST', headers })));
} else {
  console.error('Usage: node tools/cws.mjs status | publish <zip>');
  process.exit(1);
}

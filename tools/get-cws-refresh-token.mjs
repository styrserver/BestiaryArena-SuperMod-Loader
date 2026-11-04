#!/usr/bin/env node
/**
 * One-time helper: turns a Google OAuth client (Desktop app) into the CWS_REFRESH_TOKEN secret.
 * Prompts for the client ID and secret, prints the sign-in URL, asks for the code, prints the token.
 * Nothing is stored or sent anywhere except Google's token endpoint.
 *
 * Usage:
 *   node tools/get-cws-refresh-token.mjs
 */
import { createInterface } from 'node:readline/promises';

const REDIRECT = 'http://127.0.0.1';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(q)).trim();

const clientId = await ask('Client ID (ends in .apps.googleusercontent.com): ');
if (!clientId.endsWith('.apps.googleusercontent.com')) {
  console.error('That is not a client ID: it must end in .apps.googleusercontent.com (the secret starts with GOCSPX-).');
  process.exit(1);
}
const clientSecret = await ask('Client secret (starts with GOCSPX-): ');

const url = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
  response_type: 'code',
  scope: SCOPE,
  redirect_uri: REDIRECT,
  client_id: clientId,
  access_type: 'offline',
  prompt: 'consent'
});
console.log(`\n1. Open this URL, sign in with the account that owns the store listing, and approve:\n\n${url}\n`);
console.log('2. The browser then shows a page that fails to load. Copy the whole address from the address bar.\n');
const pasted = await ask('Paste that address (or just the code): ');
rl.close();

let code = pasted;
try {
  code = new URL(pasted).searchParams.get('code') ?? pasted;
} catch {
  // not a URL: treat as the bare code
}
code = decodeURIComponent(code);

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code'
  })
});
const body = await res.json();
if (!res.ok || !body.refresh_token) {
  console.error('\nFailed:', body.error ?? res.status, body.error_description ?? '');
  if (res.ok) console.error('No refresh_token returned: remove the app at myaccount.google.com/permissions and run again.');
  process.exit(1);
}
console.log('\nCWS_REFRESH_TOKEN (add as a GitHub secret, do not share):\n');
console.log(body.refresh_token);

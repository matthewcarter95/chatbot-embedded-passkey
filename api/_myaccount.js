const axios = require('axios');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const TENANT_CANONICAL = 'agentic-ai-rag.cic-demo-platform.auth0app.com';
const MYACCOUNT_AUDIENCE = `https://${TENANT_CANONICAL}/me/`;
const CLIENT_ID = 'n1k54VpNs3Hpp7hkxYFPUfRqNgXOaj6W';

async function exchangeRefreshToken(refreshToken, scope) {
  const res = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    audience: MYACCOUNT_AUDIENCE,
    scope
  }, { headers: { 'Content-Type': 'application/json' } });

  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token || refreshToken
  };
}

function myaccountUrl(path) {
  return `https://${AUTH0_DOMAIN}/me/v1${path}`;
}

function decodeJwtPayload(token) {
  try {
    const parts = (token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function callMyAccount(method, path, accessToken, body) {
  const res = await axios({
    method,
    url: myaccountUrl(path),
    data: body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  });
  if (res.status >= 400) {
    const claims = decodeJwtPayload(accessToken);
    console.error('MyAccount call failed', method, path, 'status=', res.status,
      'data=', JSON.stringify(res.data),
      'token_claims=', JSON.stringify({ iss: claims?.iss, aud: claims?.aud, scope: claims?.scope, azp: claims?.azp, sub: claims?.sub, auth_time: claims?.auth_time, amr: claims?.amr }));
    res.tokenClaims = claims;
  }
  return { status: res.status, data: res.data, tokenClaims: res.tokenClaims };
}

module.exports.decodeJwtPayload = decodeJwtPayload;

function readRefreshToken(req) {
  return (req.headers['x-refresh-token'] || req.body?.refresh_token || '').toString().trim();
}

module.exports = {
  exchangeRefreshToken,
  callMyAccount,
  readRefreshToken,
  MYACCOUNT_AUDIENCE
};

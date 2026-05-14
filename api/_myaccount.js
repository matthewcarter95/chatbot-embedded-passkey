const axios = require('axios');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;

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

function readBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

async function callMyAccount(method, path, accessToken, body) {
  const res = await axios({
    method,
    url: `https://${AUTH0_DOMAIN}/me/v1${path}`,
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
      'token_claims=', JSON.stringify({
        iss: claims?.iss, aud: claims?.aud, scope: claims?.scope,
        azp: claims?.azp, sub: claims?.sub, auth_time: claims?.auth_time, amr: claims?.amr
      }));
    res.tokenClaims = claims;
  }
  return { status: res.status, data: res.data, tokenClaims: res.tokenClaims };
}

module.exports = { callMyAccount, readBearer, decodeJwtPayload };

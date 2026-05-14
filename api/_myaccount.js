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
  return { status: res.status, data: res.data };
}

function readRefreshToken(req) {
  return (req.headers['x-refresh-token'] || req.body?.refresh_token || '').toString().trim();
}

module.exports = {
  exchangeRefreshToken,
  callMyAccount,
  readRefreshToken,
  MYACCOUNT_AUDIENCE
};

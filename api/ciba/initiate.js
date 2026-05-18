const axios = require('axios');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_SPA_CLIENT_ID;
const CIBA_AUDIENCE = process.env.AUTH0_CIBA_AUDIENCE || 'api://beneficiary/manage';
const JWKS = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!idToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(idToken, JWKS, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: CLIENT_ID
    }));
  } catch (err) {
    return res.status(401).json({ error: `Invalid id_token: ${err.message}` });
  }

  const { beneficiary } = req.body || {};
  if (!beneficiary || !beneficiary.name || !beneficiary.percentage) {
    return res.status(400).json({ error: 'Missing beneficiary.name or beneficiary.percentage' });
  }

  const name = String(beneficiary.name).slice(0, 80);
  const percentage = Math.max(1, Math.min(100, Number(beneficiary.percentage) || 0));

  const login_hint = JSON.stringify({
    format: 'iss_sub',
    iss: `https://${AUTH0_DOMAIN}/`,
    sub: claims.sub
  });

  const safeName = name.replace(/[^A-Za-z0-9 +\-_.,:#]/g, ' ').replace(/\s+/g, ' ').trim();
  const binding_message = `Add ${safeName} at ${percentage} percent`.slice(0, 64);

  const params = new URLSearchParams({
    client_id: (process.env.AUTH0_CIBA_CLIENT_ID || '').trim(),
    client_secret: (process.env.AUTH0_CIBA_CLIENT_SECRET || '').trim(),
    login_hint,
    binding_message,
    audience: CIBA_AUDIENCE,
    scope: 'openid add:beneficiary'
  });

  try {
    const response = await axios.post(
      `https://${AUTH0_DOMAIN}/bc-authorize`,
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true
      }
    );
    if (response.status >= 400) {
      console.error('bc-authorize failed', response.status, response.data);
      return res.status(response.status).json({
        error: 'CIBA initiate failed',
        detail: response.data
      });
    }
    res.json({
      auth_req_id: response.data.auth_req_id,
      expires_in: response.data.expires_in,
      interval: response.data.interval || 5,
      binding_message
    });
  } catch (error) {
    console.error('CIBA initiate error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'CIBA initiate error',
      detail: error.response?.data || error.message
    });
  }
};

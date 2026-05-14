const axios = require('axios');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { auth_req_id } = req.body || {};
  if (!auth_req_id) {
    return res.status(400).json({ error: 'Missing auth_req_id' });
  }

  const params = new URLSearchParams({
    grant_type: 'urn:openid:params:grant-type:ciba',
    auth_req_id,
    client_id: (process.env.AUTH0_CIBA_CLIENT_ID || '').trim(),
    client_secret: (process.env.AUTH0_CIBA_CLIENT_SECRET || '').trim()
  });

  try {
    const response = await axios.post(
      `https://${AUTH0_DOMAIN}/oauth/token`,
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true
      }
    );

    if (response.status === 200) {
      return res.json({ status: 'approved' });
    }

    const errorCode = response.data?.error;
    if (errorCode === 'authorization_pending') return res.json({ status: 'pending' });
    if (errorCode === 'slow_down')              return res.json({ status: 'pending', slow_down: true });
    if (errorCode === 'access_denied')          return res.json({ status: 'denied' });
    if (errorCode === 'expired_token')          return res.json({ status: 'expired' });

    console.error('CIBA status unexpected error', response.status, response.data);
    res.status(response.status).json({
      status: 'error',
      error: errorCode || 'unknown',
      detail: response.data
    });
  } catch (error) {
    console.error('CIBA status error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      error: 'request failed',
      detail: error.response?.data || error.message
    });
  }
};

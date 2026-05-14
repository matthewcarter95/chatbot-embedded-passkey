const { exchangeRefreshToken, callMyAccount, readRefreshToken } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const { access_token, refresh_token } = await exchangeRefreshToken(
      refreshToken,
      'read:me:authentication_methods'
    );

    const list = await callMyAccount('GET', '/authentication-methods', access_token);
    if (list.status >= 400) {
      return res.status(list.status).json({
        error: 'MyAccount list failed',
        detail: list.data,
        token_claims: list.tokenClaims || null,
        refresh_token
      });
    }

    const methods = Array.isArray(list.data) ? list.data : (list.data?.authentication_methods || []);
    const push = methods.find(m => m.type === 'push-notification' && m.confirmed);

    res.json({
      enrolled: !!push,
      push_method: push || null,
      refresh_token
    });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('enroll-push/status error:', detail);
    res.status(error.response?.status || 500).json({
      error: 'Status check failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

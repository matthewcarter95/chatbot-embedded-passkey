const { exchangeRefreshToken, callMyAccount, readRefreshToken } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const refreshToken = readRefreshToken(req);
  const { id, auth_session } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }
  if (!id || !auth_session) {
    return res.status(400).json({ error: 'Missing id or auth_session' });
  }

  try {
    const { access_token, refresh_token } = await exchangeRefreshToken(
      refreshToken,
      'create:me:authentication_methods read:me:authentication_methods'
    );

    const verify = await callMyAccount(
      'POST',
      `/authentication-methods/${encodeURIComponent(id)}/verify`,
      access_token,
      { auth_session }
    );

    if (verify.status === 200 || verify.status === 204) {
      return res.json({ confirmed: true, refresh_token });
    }

    if (verify.status === 400 || verify.status === 409) {
      const list = await callMyAccount('GET', '/authentication-methods', access_token);
      const methods = Array.isArray(list.data) ? list.data : (list.data?.authentication_methods || []);
      const method = methods.find(m => m.id === id);
      return res.json({
        confirmed: !!method?.confirmed,
        detail: verify.data,
        refresh_token
      });
    }

    res.status(verify.status).json({
      error: 'Verify failed',
      detail: verify.data,
      refresh_token
    });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('enroll-push/verify error:', detail);
    res.status(error.response?.status || 500).json({
      error: 'Enrollment verify failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

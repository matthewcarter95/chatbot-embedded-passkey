const { exchangeRefreshToken, callMyAccount, readRefreshToken } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const { access_token, refresh_token } = await exchangeRefreshToken(
      refreshToken,
      'create:me:authentication_methods'
    );

    const create = await callMyAccount('POST', '/authentication-methods', access_token, {
      type: 'push-notification'
    });

    if (create.status >= 400) {
      return res.status(create.status).json({
        error: 'MyAccount enrollment failed',
        detail: create.data,
        token_claims: create.tokenClaims || null,
        refresh_token
      });
    }

    res.json({
      id: create.data.id,
      auth_session: create.data.auth_session,
      barcode_uri: create.data.barcode_uri,
      manual_input_code: create.data.manual_input_code,
      refresh_token
    });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('enroll-push/start error:', detail);
    res.status(error.response?.status || 500).json({
      error: 'Enrollment start failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

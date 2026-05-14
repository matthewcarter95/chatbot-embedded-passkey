const { callMyAccount, readBearer } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = readBearer(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const create = await callMyAccount('POST', '/authentication-methods', accessToken, {
      type: 'push-notification'
    });

    if (create.status >= 400) {
      return res.status(create.status).json({
        error: 'MyAccount enrollment failed',
        detail: create.data,
        token_claims: create.tokenClaims || null
      });
    }

    res.json({
      id: create.data.id,
      auth_session: create.data.auth_session,
      barcode_uri: create.data.barcode_uri,
      manual_input_code: create.data.manual_input_code
    });
  } catch (error) {
    console.error('enroll-push/start error:', error.message);
    res.status(500).json({ error: 'Enrollment start failed', detail: error.message });
  }
};

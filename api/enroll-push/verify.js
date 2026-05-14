const { callMyAccount, readBearer } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = readBearer(req);
  const { id, auth_session } = req.body || {};
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  if (!id || !auth_session) {
    return res.status(400).json({ error: 'Missing id or auth_session' });
  }

  try {
    const verify = await callMyAccount(
      'POST',
      `/authentication-methods/${encodeURIComponent(id)}/verify`,
      accessToken,
      { auth_session }
    );

    if (verify.status === 200 || verify.status === 204) {
      return res.json({ confirmed: true });
    }

    if (verify.status === 400 || verify.status === 409) {
      const list = await callMyAccount('GET', '/authentication-methods', accessToken);
      const methods = Array.isArray(list.data) ? list.data : (list.data?.authentication_methods || []);
      const method = methods.find(m => m.id === id);
      return res.json({
        confirmed: !!method?.confirmed,
        detail: verify.data
      });
    }

    res.status(verify.status).json({
      error: 'Verify failed',
      detail: verify.data,
      token_claims: verify.tokenClaims || null
    });
  } catch (error) {
    console.error('enroll-push/verify error:', error.message);
    res.status(500).json({ error: 'Enrollment verify failed', detail: error.message });
  }
};

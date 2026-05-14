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
      {}
    );

    if (verify.status === 200 || verify.status === 201 || verify.status === 202 || verify.status === 204) {
      return res.json({ ok: true, detail: verify.data });
    }

    return res.status(verify.status).json({
      error: 'Verify call failed',
      detail: verify.data,
      token_claims: verify.tokenClaims || null
    });
  } catch (error) {
    console.error('enroll-push/verify error:', error.message);
    res.status(500).json({ error: 'Verify call error', detail: error.message });
  }
};

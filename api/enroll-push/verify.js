const { callMyAccount, readBearer } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = readBearer(req);
  const { id } = req.body || {};
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  if (!id) {
    return res.status(400).json({ error: 'Missing id' });
  }

  try {
    const list = await callMyAccount('GET', '/authentication-methods', accessToken);
    if (list.status >= 400) {
      return res.status(list.status).json({
        error: 'List failed',
        detail: list.data,
        token_claims: list.tokenClaims || null
      });
    }
    const methods = Array.isArray(list.data) ? list.data : (list.data?.authentication_methods || []);
    const method = methods.find(m => m.id === id);
    return res.json({
      confirmed: !!method?.confirmed,
      method: method || null
    });
  } catch (error) {
    console.error('enroll-push/verify error:', error.message);
    res.status(500).json({ error: 'Verify failed', detail: error.message });
  }
};

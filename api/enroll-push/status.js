const { callMyAccount, readBearer } = require('../_myaccount');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = readBearer(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const list = await callMyAccount('GET', '/authentication-methods', accessToken);
    if (list.status >= 400) {
      return res.status(list.status).json({
        error: 'MyAccount list failed',
        detail: list.data,
        token_claims: list.tokenClaims || null
      });
    }

    const methods = Array.isArray(list.data) ? list.data : (list.data?.authentication_methods || []);
    const push = methods.find(m => m.type === 'push-notification' && m.confirmed);

    res.json({
      enrolled: !!push,
      push_method: push || null
    });
  } catch (error) {
    console.error('enroll-push/status error:', error.message);
    res.status(500).json({ error: 'Status check failed', detail: error.message });
  }
};

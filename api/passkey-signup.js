const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestBody = {
      grant_type: 'urn:okta:params:oauth:grant-type:webauthn',
      client_id: req.body.client_id,
      auth_session: req.body.auth_session,
      // CORRECTED: Use req.body.credential from the frontend
      authn_response: req.body.credential 
    };
    
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Request failed' });
  }
};

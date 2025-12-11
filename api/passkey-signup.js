const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Add required fields for OAuth token endpoint
    const requestBody = {
      grant_type: 'urn:okta:params:oauth:grant-type:webauthn',
      ...req.body
    };
    
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Request failed' });
  }
};
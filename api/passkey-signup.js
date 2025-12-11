const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Add user_profile if not present (needed for completion call)
    const requestBody = {
      ...req.body,
      user_profile: req.body.user_profile || { email: req.body.email }
    };
    
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/passkey/register`, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Request failed' });
  }
};
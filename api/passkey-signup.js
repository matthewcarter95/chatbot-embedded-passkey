const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user_profile = {
      
      email: req.body.email
      // name: req.body.name,
      // Add other user profile fields as needed
    };

    const requestBody = {
      // The realm where the passkey will be registered (e.g., 'Username-Password-Authentication')
      realm: 'DefaultTenantPasskey', 
      
      // The profile information for the user (often includes 'user_id' and 'email')
      user_profile: user_profile, 
      
      // (Optional) You can spread existing data from req.body if it contains other necessary fields
      // ...req.body,
    };
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/passkey/register`, 
      req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Request failed' });
  }
};
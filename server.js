const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve static files explicitly for Vercel
app.get('/config.js', (req, res) => {
  res.sendFile(__dirname + '/public/config.js');
});

app.get('/app.js', (req, res) => {
  res.sendFile(__dirname + '/public/app.js');
});

// Root route for Vercel
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Auth0 Management API token
let managementToken = null;

async function getManagementToken() {
  if (managementToken) return managementToken;
  
  try {
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials'
    });
    managementToken = response.data.access_token;
    return managementToken;
  } catch (error) {
    console.error('Error getting management token:', error.response?.data);
    throw error;
  }
}

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    // Simple OpenAI integration (replace with your preferred AI service)
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ 
      response: response.data.choices[0].message.content,
      userId 
    });
  } catch (error) {
    console.error('Chat error:', error.response?.data);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
  try {
    const token = await getManagementToken();
    const response = await axios.get(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${req.params.userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error('User fetch error:', error.response?.data);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

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
};
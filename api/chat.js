const axios = require('axios');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const API_AUDIENCE = 'https://chatterbox-api.demo-connect.us';
const JWKS = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: API_AUDIENCE
    }));
  } catch (err) {
    return res.status(401).json({ error: `Invalid token: ${err.message}` });
  }

  const userId = payload.sub;
  const { message, email, history, needsPushEnrollment } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const promptLines = [
    'You are a concise assistant inside a passkey-authenticated demo chatbot.',
    'The authenticated user is identified by:',
    `- user_id (Auth0 sub): ${userId}`,
    `- email: ${email || 'unknown'}`,
    "Answer questions about the user's profile using these facts.",
    'For other questions, be brief and helpful.'
  ];

  if (needsPushEnrollment) {
    promptLines.push(
      '',
      'The user has NOT enrolled a push authentication method yet. ' +
      'If the user agrees to enroll — explicitly or with a clear affirmative like "yes", "sure", "ok", "let\'s do it", "go ahead" — ' +
      'end your reply with the exact token [[ENROLL_PUSH]] on its own line and nothing after. ' +
      'Do not emit this token otherwise. Do not mention the token itself to the user.'
    );
  }

  const systemPrompt = promptLines.join('\n');

  const priorTurns = Array.isArray(history)
    ? history.filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(-20)
    : [];

  try {
    const groqRes = await axios.post(GROQ_URL, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorTurns,
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.3
    }, {
      headers: {
        Authorization: `Bearer ${(process.env.GROQ_API_KEY || '').trim()}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      response: groqRes.data.choices[0].message.content,
      userId
    });
  } catch (error) {
    const detail = error.response?.data?.error?.message
      || error.response?.data?.error
      || error.response?.data
      || error.message
      || 'unknown';
    console.error('Groq error status=', error.response?.status, 'detail=', detail);
    res.status(error.response?.status || 500).json({
      error: `Chat service error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
    });
  }
};

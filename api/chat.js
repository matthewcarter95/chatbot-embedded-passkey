const axios = require('axios');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = 'n1k54VpNs3Hpp7hkxYFPUfRqNgXOaj6W';
const JWKS = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  let payload = null;
  if (token) {
    try {
      ({ payload } = await jwtVerify(token, JWKS, {
        issuer: `https://${AUTH0_DOMAIN}/`,
        audience: CLIENT_ID
      }));
    } catch (err) {
      // Invalid tokens treated as anonymous; client will re-auth on its own.
      payload = null;
    }
  }

  const authenticated = !!payload;
  const userId = payload?.sub || null;
  const { message, email, history, needsPushEnrollment } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  let promptLines;
  if (authenticated) {
    promptLines = [
      'You are a concise assistant inside a passkey-authenticated demo chatbot.',
      'The authenticated user is identified by:',
      `- user_id (Auth0 sub): ${userId}`,
      `- email: ${email || 'unknown'}`,
      "Answer questions about the user's profile using these facts.",
      'For other questions, be brief and helpful.',
      '',
      'ENROLLMENT TRIGGER: The UI can enroll an Auth0 Guardian push authentication method for this user. ' +
      'This is the ONLY way to produce a QR code for Guardian — you cannot show QR codes yourself, you cannot generate enrollment codes, you MUST NOT invent one. ' +
      'If the user asks to enroll a push factor / MFA / Guardian / authenticator / QR code, ' +
      'OR agrees to enrolling when asked (yes, sure, ok, let\'s do it, go ahead, etc.), ' +
      'end your reply with the exact token [[ENROLL_PUSH]] on its own line and nothing after. ' +
      'Do not mention the token itself to the user. Keep the reply short — one sentence confirming you\'re starting the enrollment is enough.',
      '',
      'ADD BENEFICIARY TRIGGER: When the user wants to add a beneficiary to their account, ' +
      'you must gather two fields — full legal name (string) and percentage allotted (integer 1-100). ' +
      'If either is missing, ASK for the missing one and stop. ' +
      'When you have both, end your reply with exactly this JSON token on its own line: ' +
      '[[ADD_BENEFICIARY:{"name":"<full legal name>","percentage":<integer>}]] ' +
      'Valid example: [[ADD_BENEFICIARY:{"name":"Jane Doe","percentage":100}]]. ' +
      'Do not mention this token to the user. Reply text should simply confirm you are initiating an approval request on their phone. ' +
      'You do not and cannot actually add the beneficiary yourself — the UI handles that via a push approval flow.'
    ];
    if (needsPushEnrollment) {
      promptLines.push(
        '',
        'SESSION NOTE: The user does not currently have a push factor enrolled. ' +
        'If the conversation allows, proactively suggest enrolling one to protect sensitive transactions.'
      );
    }
  } else {
    promptLines = [
      'You are a concise assistant inside a demo chatbot.',
      'The user is NOT signed in. You have no access to their profile, account, or user_id.',
      'Answer general questions helpfully and briefly.',
      'If the user asks about their account, profile, enrollment, push MFA, or adding a beneficiary, ' +
      'respond that they need to sign in first using the Sign Up or Log In button with their passkey, then try again. ' +
      'Do NOT emit any control tokens like [[ENROLL_PUSH]] or [[ADD_BENEFICIARY:...]] — those only work for signed-in users and the UI will ignore them here.'
    ];
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

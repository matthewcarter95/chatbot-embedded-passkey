const axios = require('axios');
const crypto = require('crypto');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const SPA_CLIENT_ID = process.env.AUTH0_SPA_CLIENT_ID;
const VERIFY_SECRET = (process.env.AUTH0_CLIENT_SECRET || 'dev-fallback').slice(0, 32);

function signProof(phone) {
  const ts = Date.now();
  const payload = `${phone}|${ts}`;
  const sig = crypto.createHmac('sha256', VERIFY_SECRET).update(payload).digest('base64url');
  return `${ts}.${sig}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { phone_number, otp } = req.body || {};
  if (!phone_number || !otp) {
    return res.status(400).json({ error: 'phone_number and otp required' });
  }
  try {
    const r = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: SPA_CLIENT_ID,
      username: phone_number,
      otp,
      realm: 'sms',
      scope: 'openid'
    }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
    if (r.status >= 400) {
      console.error('passwordless OTP grant failed', r.status, r.data);
      return res.status(r.status).json({ error: 'OTP verify failed', detail: r.data });
    }
    res.json({ ok: true, proof: signProof(phone_number) });
  } catch (e) {
    console.error('sms/verify error:', e.response?.data || e.message);
    res.status(500).json({ error: 'OTP verify error', detail: e.response?.data || e.message });
  }
};

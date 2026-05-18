const axios = require('axios');
const crypto = require('crypto');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const SPA_CLIENT_ID = process.env.AUTH0_SPA_CLIENT_ID;
const VERIFY_SECRET = (process.env.AUTH0_CLIENT_SECRET || 'dev-fallback').slice(0, 32);

function signProof(phone) {
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', VERIFY_SECRET).update(`${phone}|${ts}`).digest('base64url');
  return `${ts}.${sig}`;
}

async function startOtp({ phone_number }) {
  const r = await axios.post(`https://${AUTH0_DOMAIN}/passwordless/start`, {
    client_id: SPA_CLIENT_ID,
    connection: 'sms',
    phone_number,
    send: 'code'
  }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
  return { status: r.status, data: r.data };
}

async function verifyOtp({ phone_number, otp }) {
  const r = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
    grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
    client_id: SPA_CLIENT_ID,
    username: phone_number,
    otp,
    realm: 'sms',
    scope: 'openid'
  }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
  return { status: r.status, data: r.data };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { action, phone_number, otp } = req.body || {};
  if (!phone_number || !/^\+[1-9]\d{6,14}$/.test(phone_number)) {
    return res.status(400).json({ error: 'phone_number must be E.164, like +15551234567' });
  }

  try {
    if (action === 'start') {
      const r = await startOtp({ phone_number });
      if (r.status >= 400) {
        console.error('passwordless/start failed', r.status, r.data);
        return res.status(r.status).json({ error: 'SMS send failed', detail: r.data });
      }
      return res.json({ ok: true });
    }
    if (action === 'verify') {
      if (!otp) return res.status(400).json({ error: 'otp required' });
      const r = await verifyOtp({ phone_number, otp });
      if (r.status >= 400) {
        console.error('passwordless OTP grant failed', r.status, r.data);
        return res.status(r.status).json({ error: 'OTP verify failed', detail: r.data });
      }
      return res.json({ ok: true, proof: signProof(phone_number) });
    }
    return res.status(400).json({ error: 'action must be "start" or "verify"' });
  } catch (e) {
    console.error('sms error:', e.response?.data || e.message);
    res.status(500).json({ error: 'SMS error', detail: e.response?.data || e.message });
  }
};

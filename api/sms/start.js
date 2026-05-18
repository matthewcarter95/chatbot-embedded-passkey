const axios = require('axios');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const SPA_CLIENT_ID = process.env.AUTH0_SPA_CLIENT_ID;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { phone_number } = req.body || {};
  if (!phone_number || !/^\+[1-9]\d{6,14}$/.test(phone_number)) {
    return res.status(400).json({ error: 'phone_number must be E.164, like +15551234567' });
  }
  try {
    const r = await axios.post(`https://${AUTH0_DOMAIN}/passwordless/start`, {
      client_id: SPA_CLIENT_ID,
      connection: 'sms',
      phone_number,
      send: 'code'
    }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
    if (r.status >= 400) {
      console.error('passwordless/start failed', r.status, r.data);
      return res.status(r.status).json({ error: 'SMS send failed', detail: r.data });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('sms/start error:', e.response?.data || e.message);
    res.status(500).json({ error: 'SMS start error', detail: e.response?.data || e.message });
  }
};

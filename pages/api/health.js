// pages/api/health.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const present = (key) => Boolean(process.env[key]);

  return res.status(200).json({
    ok: true,
    env: {
      ZAWS_REGION: present('ZAWS_REGION'),
      ZAWS_ACCESS_KEY_ID: present('ZAWS_ACCESS_KEY_ID'),
      ZAWS_SECRET_ACCESS_KEY: present('ZAWS_SECRET_ACCESS_KEY'),
      DYNAMODB_TABLE_NAME: present('DYNAMODB_TABLE_NAME'),
      DYNAMODB_TABLE_NAME: present('DYNAMODB_TABLE_NAME'),
      DYNAMODB_REQUEST_OFFERS_TABLE_NAME: present('DYNAMODB_REQUEST_OFFERS_TABLE_NAME'),
      N8N_REQUEST_SUBMIT_WEBHOOK_URL: present('N8N_REQUEST_SUBMIT_WEBHOOK_URL'),
      N8N_ACCEPT_OFFER_WEBHOOK_URL: present('N8N_ACCEPT_OFFER_WEBHOOK_URL'),
      N8N_CLOSE_REQUEST_WEBHOOK_URL: present('N8N_CLOSE_REQUEST_WEBHOOK_URL'),
    },
  });
}


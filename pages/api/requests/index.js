// pages/api/requests/index.js
import { DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({
  region: process.env.ZAWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.ZAWS_SECRET_ACCESS_KEY,
  },
});

const REQUESTS_TABLE = process.env.DYNAMODB_TABLE_NAME || 'FlowExOffers';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeCreatedAt = (item) => {
  const raw = item.createdAt ?? item.time ?? item.Timestamp ?? item.timestamp;
  if (raw === undefined || raw === null) {
    return new Date().toISOString();
  }

  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(numeric)) {
    if (numeric > 1e12) {
      return new Date(numeric).toISOString();
    }
    if (numeric > 1e10) {
      return new Date(numeric * 1000).toISOString();
    }
    if (numeric > 20000) {
      return new Date((numeric - 25569) * 86400 * 1000).toISOString();
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
};

const normalizeRequest = (item) => ({
  ...item,
  requestId: item.requestId ?? item.uuid ?? item.id ?? null,
  needCurrency: item.needCurrency ?? item.wantCurrency ?? null,
  haveCurrency: item.haveCurrency ?? null,
  haveAmount: item.haveAmount ?? null,
  createdAt: normalizeCreatedAt(item),
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const command = new ScanCommand({
        TableName: REQUESTS_TABLE,
      });

      const response = await dynamoClient.send(command);
      const items = response.Items ? response.Items.map(item => normalizeRequest(unmarshall(item))) : [];
      return res.status(200).json(items);
    } catch (error) {
      console.error('Error fetching requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    const {
      name,
      email,
      phone,
      needCurrency,
      haveCurrency,
      haveAmount,
    } = req.body || {};

    const amountNumber = Number(haveAmount);
    if (!name || !phone || !needCurrency || !haveCurrency || !Number.isFinite(amountNumber)) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    try {
      const payload = {
        name,
        email,
        phone,
        needCurrency,
        haveCurrency,
        haveAmount: amountNumber,
        createdAt: new Date().toISOString(),
      };

      const webhookUrl = process.env.N8N_REQUEST_SUBMIT_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ error: 'Missing request submit webhook URL' });
      }
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        const text = await webhookResponse.text();
        return res.status(502).json({ error: 'Webhook request failed', details: text });
      }

      return res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error creating request:', error);
      return res.status(500).json({
        error: 'Failed to create request',
        details: error?.message || String(error),
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


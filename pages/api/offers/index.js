// pages/api/offers/index.js
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.ZAWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.ZAWS_SECRET_ACCESS_KEY,
  },
});

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

const normalizeOffer = (item) => ({
  ...item,
  wantAmount: item.wantAmount ?? item.needAmount ?? null,
  wantCurrency: item.wantCurrency ?? item.needCurrency ?? null,
  createdAt: normalizeCreatedAt(item),
  status: item.status ?? 'open',
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const command = new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'FlowExOffers',
    });

    const response = await dynamoClient.send(command);
    const offers = response.Items.map(item => normalizeOffer(unmarshall(item)));

    return res.status(200).json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
}


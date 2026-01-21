// pages/api/requests/[requestId]/offers/[offerId]/accept.js
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.ZAWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.ZAWS_SECRET_ACCESS_KEY,
  },
});

const REQUEST_OFFERS_TABLE =
  process.env.DYNAMODB_REQUEST_OFFERS_TABLE_NAME || 'CurrencyExchangeRequestOffers';
const REQUESTS_TABLE = process.env.DYNAMODB_TABLE_NAME || 'FlowExOffers';

export default async function handler(req, res) {
  const { requestId, offerId } = req.query;
  if (!requestId || !offerId || typeof requestId !== 'string' || typeof offerId !== 'string') {
    return res.status(400).json({ error: 'Missing requestId or offerId' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const command = new UpdateItemCommand({
      TableName: REQUEST_OFFERS_TABLE,
      Key: marshall({ requestId, offerId }),
      UpdateExpression: 'SET accepted = :accepted, acceptedAt = :acceptedAt',
      ExpressionAttributeValues: marshall({
        ':accepted': true,
        ':acceptedAt': new Date().toISOString(),
      }),
    });

    await dynamoClient.send(command);

    const loadRequest = async (keyName) => {
      const requestResponse = await dynamoClient.send(
        new GetItemCommand({
          TableName: REQUESTS_TABLE,
          Key: marshall({ [keyName]: requestId }),
        })
      );
      return requestResponse.Item ? unmarshall(requestResponse.Item) : null;
    };

    let requestDetails = await loadRequest('uuid');
    if (!requestDetails) {
      requestDetails = await loadRequest('requestId');
    }

    const webhookUrl = process.env.N8N_ACCEPT_OFFER_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'Missing accept offer webhook URL' });
    }
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        offerId,
        request: {
          name: requestDetails?.name || null,
          email: requestDetails?.email || null,
          phone: requestDetails?.phone || null,
          needCurrency: requestDetails?.needCurrency || requestDetails?.wantCurrency || null,
          haveCurrency: requestDetails?.haveCurrency || null,
          haveAmount: requestDetails?.haveAmount || null,
        },
        offer: req.body?.offer || null,
      }),
    });

    if (!webhookResponse.ok) {
      const text = await webhookResponse.text();
      return res.status(502).json({ error: 'Webhook request failed', details: text });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error accepting offer:', error);
    return res.status(500).json({
      error: 'Failed to accept offer',
      details: error?.message || String(error),
    });
  }
}



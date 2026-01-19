// pages/api/requests/[requestId]/close.js
import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const REQUESTS_TABLE =
  process.env.DYNAMODB_REQUESTS_TABLE_NAME ||
  process.env.DYNAMODB_TABLE_NAME ||
  'FlowExOffers';
const REQUEST_OFFERS_TABLE =
  process.env.DYNAMODB_REQUEST_OFFERS_TABLE_NAME || 'CurrencyExchangeRequestOffers';

export default async function handler(req, res) {
  const { requestId } = req.query;
  if (!requestId || typeof requestId !== 'string') {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const updateWithKey = async (keyName) => {
    const command = new UpdateItemCommand({
      TableName: REQUESTS_TABLE,
      Key: marshall({ [keyName]: requestId }),
      UpdateExpression: 'SET #status = :status, closedAt = :closedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'closed',
        ':closedAt': new Date().toISOString(),
      }),
    });

    await dynamoClient.send(command);
  };

  const loadRequestDetails = async (keyName) => {
    const requestResponse = await dynamoClient.send(
      new GetItemCommand({
        TableName: REQUESTS_TABLE,
        Key: marshall({ [keyName]: requestId }),
      })
    );
    return requestResponse.Item ? unmarshall(requestResponse.Item) : null;
  };

  try {
    await updateWithKey('uuid');
    const offersResponse = await dynamoClient.send(
      new QueryCommand({
        TableName: REQUEST_OFFERS_TABLE,
        KeyConditionExpression: 'requestId = :requestId',
        ExpressionAttributeValues: marshall({
          ':requestId': requestId,
        }),
      })
    );

    const offers = offersResponse.Items
      ? offersResponse.Items.map((item) => unmarshall(item))
      : [];
    const emails = [...new Set(offers.map((offer) => offer.responderEmail).filter(Boolean))];

    const webhookUrl = process.env.N8N_CLOSE_REQUEST_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'Missing close request webhook URL' });
    }
    let requestItem = await loadRequestDetails('uuid');
    if (!requestItem) {
      requestItem = await loadRequestDetails('requestId');
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        emails,
        requester: requestItem ? {
          name: requestItem.name || null,
          email: requestItem.email || null,
          phone: requestItem.phone || null,
          needCurrency: requestItem.needCurrency || requestItem.wantCurrency || null,
          haveCurrency: requestItem.haveCurrency || null,
          haveAmount: requestItem.haveAmount || null,
        } : null,
      }),
    });

    if (!webhookResponse.ok) {
      const text = await webhookResponse.text();
      return res.status(502).json({ error: 'Webhook request failed', details: text });
    }

    return res.status(200).json({ success: true, keyUsed: 'uuid', emailsCount: emails.length });
  } catch (error) {
    const message = error?.message || String(error);
    if (/key/i.test(message) && /schema|missing/i.test(message)) {
      try {
        await updateWithKey('requestId');
        const offersResponse = await dynamoClient.send(
          new QueryCommand({
            TableName: REQUEST_OFFERS_TABLE,
            KeyConditionExpression: 'requestId = :requestId',
            ExpressionAttributeValues: marshall({
              ':requestId': requestId,
            }),
          })
        );

        const offers = offersResponse.Items
          ? offersResponse.Items.map((item) => unmarshall(item))
          : [];
        const emails = [...new Set(offers.map((offer) => offer.responderEmail).filter(Boolean))];

        const webhookUrl = process.env.N8N_CLOSE_REQUEST_WEBHOOK_URL;
        if (!webhookUrl) {
          return res.status(500).json({ error: 'Missing close request webhook URL' });
        }
        let requestItem = await loadRequestDetails('requestId');
        if (!requestItem) {
          requestItem = await loadRequestDetails('uuid');
        }

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            emails,
            requester: requestItem ? {
              name: requestItem.name || null,
              email: requestItem.email || null,
              phone: requestItem.phone || null,
              needCurrency: requestItem.needCurrency || requestItem.wantCurrency || null,
              haveCurrency: requestItem.haveCurrency || null,
              haveAmount: requestItem.haveAmount || null,
            } : null,
          }),
        });

        if (!webhookResponse.ok) {
          const text = await webhookResponse.text();
          return res.status(502).json({ error: 'Webhook request failed', details: text });
        }

        return res
          .status(200)
          .json({ success: true, keyUsed: 'requestId', emailsCount: emails.length });
      } catch (innerError) {
        console.error('Error closing request with requestId:', innerError);
      }
    }

    console.error('Error closing request:', error);
    return res.status(500).json({
      error: 'Failed to close request',
      details: message,
    });
  }
}


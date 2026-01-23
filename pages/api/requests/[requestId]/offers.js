// pages/api/requests/[requestId]/offers.js
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({
  region: process.env.ZAWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.ZAWS_SECRET_ACCESS_KEY,
  },
});

const REQUEST_OFFERS_TABLE = process.env.DYNAMODB_REQUEST_OFFERS_TABLE_NAME || 'CurrencyExchangeRequestOffers';
const REQUESTS_TABLE = process.env.DYNAMODB_TABLE_NAME || 'FlowExOffers';

export default async function handler(req, res) {
  const { requestId } = req.query;
  if (!requestId || typeof requestId !== 'string') {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  if (req.method === 'GET') {
    try {
      const command = new QueryCommand({
        TableName: REQUEST_OFFERS_TABLE,
        KeyConditionExpression: 'requestId = :requestId',
        ExpressionAttributeValues: marshall({
          ':requestId': requestId,
        }),
      });

      const response = await dynamoClient.send(command);
      const items = response.Items ? response.Items.map(item => unmarshall(item)) : [];
      return res.status(200).json(items);
    } catch (error) {
      console.error('Error fetching request offers:', error);
      return res.status(500).json({
        error: 'Failed to fetch request offers',
        details: error?.message || String(error),
      });
    }
  }

  if (req.method === 'POST') {
    const { responder, offerAmount, needCurrency, haveCurrency } = req.body || {};
    const amountNumber = Number(offerAmount);

    if (!responder?.name || !responder?.email || !responder?.phone || !Number.isFinite(amountNumber)) {
      return res.status(400).json({ error: 'Invalid responder payload' });
    }

    try {
      const item = {
        requestId,
        offerId: crypto.randomUUID(),
        offerAmount: amountNumber,
        needCurrency: needCurrency || null,
        haveCurrency: haveCurrency || null,
        responderName: responder.name,
        responderEmail: responder.email,
        responderPhone: responder.phone,
        createdAt: new Date().toISOString(),
      };

      const command = new PutItemCommand({
        TableName: REQUEST_OFFERS_TABLE,
        Item: marshall(item),
      });

      await dynamoClient.send(command);
      const loadRequestDetails = async (keyName) => {
        const requestResponse = await dynamoClient.send(
          new GetItemCommand({
            TableName: REQUESTS_TABLE,
            Key: marshall({ [keyName]: requestId }),
          })
        );
        return requestResponse.Item ? unmarshall(requestResponse.Item) : null;
      };

      let requestItem = await loadRequestDetails('uuid');
      if (!requestItem) {
        requestItem = await loadRequestDetails('requestId');
      }

      const webhookUrl = process.env.N8N_OFFER_CREATED_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ error: 'Missing offer created webhook URL' });
      }

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer: item,
          offerAmount: item.offerAmount,
          responder: {
            name: item.responderName,
            email: item.responderEmail,
            phone: item.responderPhone,
          },
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

      return res.status(201).json({ success: true, offerId: item.offerId });
    } catch (error) {
      console.error('Error creating request offer:', error);
      return res.status(500).json({
        error: 'Failed to create request offer',
        details: error?.message || String(error),
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


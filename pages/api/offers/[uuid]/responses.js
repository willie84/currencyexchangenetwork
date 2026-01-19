// pages/api/offers/[uuid]/responses.js
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const RESPONSES_TABLE = process.env.DYNAMODB_RESPONSES_TABLE_NAME || 'FlowExOfferResponses';

export default async function handler(req, res) {
  const { uuid } = req.query;
  if (!uuid || typeof uuid !== 'string') {
    return res.status(400).json({ error: 'Missing offer UUID' });
  }

  if (req.method === 'GET') {
    try {
      const command = new QueryCommand({
        TableName: RESPONSES_TABLE,
        KeyConditionExpression: 'offerUuid = :offerUuid',
        ExpressionAttributeValues: marshall({
          ':offerUuid': uuid,
        }),
      });

      const response = await dynamoClient.send(command);
      const items = response.Items ? response.Items.map(item => unmarshall(item)) : [];
      return res.status(200).json(items);
    } catch (error) {
      console.error('Error fetching offer responses:', error);
      return res.status(500).json({ error: 'Failed to fetch offer responses' });
    }
  }

  if (req.method === 'POST') {
    const { responder, offerAmount, wantCurrency, haveCurrency } = req.body || {};

    if (!responder?.name || !responder?.email || !responder?.phone || !Number.isFinite(offerAmount)) {
      return res.status(400).json({ error: 'Invalid responder payload' });
    }

    try {
      const item = {
        offerUuid: uuid,
        responseId: crypto.randomUUID(),
        offerAmount,
        wantCurrency: wantCurrency || null,
        haveCurrency: haveCurrency || null,
        responderName: responder.name,
        responderEmail: responder.email,
        responderPhone: responder.phone,
        createdAt: new Date().toISOString(),
      };

      const command = new PutItemCommand({
        TableName: RESPONSES_TABLE,
        Item: marshall(item),
      });

      await dynamoClient.send(command);
      return res.status(201).json({ success: true, responseId: item.responseId });
    } catch (error) {
      console.error('Error saving offer response:', error);
      return res.status(500).json({ error: 'Failed to save offer response' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}





// pages/api/offers/[uuid]/complete.js
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.ZAWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.ZAWS_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uuid } = req.query;
  const { uuid: bodyUuid } = req.body;

  // Validate UUID matches
  if (!uuid || uuid !== bodyUuid) {
    return res.status(400).json({ error: 'Invalid UUID' });
  }

  try {
    const command = new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'FlowExOffers',
      Key: marshall({ uuid }),
      UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'completed',
        ':completedAt': new Date().toISOString(),
      }),
    });

    await dynamoClient.send(command);

    return res.status(200).json({ success: true, message: 'Offer marked as complete' });
  } catch (error) {
    console.error('Error updating offer:', error);
    return res.status(500).json({ error: 'Failed to update offer' });
  }
}


import axios from 'axios';

const IG_GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0';
const IG_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_TIMEOUT_MS = Number(process.env.INSTAGRAM_TIMEOUT_MS || 30000);

export async function sendInstagramTextMessage(input: {
  recipientId: string;
  message: string;
}): Promise<{ success: boolean; id?: string; error?: string; raw?: any }> {
  try {
    if (!IG_BUSINESS_ACCOUNT_ID || !IG_ACCESS_TOKEN) {
      return {
        success: false,
        error: 'Instagram API credentials are not configured',
      };
    }

    const url = `https://graph.facebook.com/${IG_GRAPH_API_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/messages`;
    const response = await axios.post(
      url,
      {
        recipient: { id: input.recipientId },
        message: { text: input.message },
        messaging_type: 'RESPONSE',
      },
      {
        params: {
          access_token: IG_ACCESS_TOKEN,
        },
        timeout: IG_TIMEOUT_MS,
      }
    );

    return {
      success: true,
      id: response.data?.message_id || response.data?.id,
      raw: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to send Instagram message',
      raw: error?.response?.data,
    };
  }
}

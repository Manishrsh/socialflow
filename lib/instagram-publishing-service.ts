import axios from 'axios';

function nonEmpty(value: any): string {
  return String(value || '').trim();
}

export async function createInstagramMediaContainer(input: {
  businessAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  apiVersion?: string;
}): Promise<{ success: boolean; containerId?: string; error?: string; raw?: any }> {
  try {
    const businessAccountId = nonEmpty(input.businessAccountId);
    const accessToken = nonEmpty(input.accessToken);
    const apiVersion = nonEmpty(input.apiVersion || process.env.META_GRAPH_API_VERSION || process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0');

    if (!businessAccountId || !accessToken) {
      return { success: false, error: 'Instagram publishing credentials are not configured' };
    }

    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/media`,
      {
        image_url: input.imageUrl,
        caption: input.caption,
        share_to_feed: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.INSTAGRAM_TIMEOUT_MS || 30000),
      }
    );

    return {
      success: true,
      containerId: response.data?.id || response.data?.creation_id,
      raw: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error?.message || error?.message || 'Failed to create Instagram media container',
      raw: error?.response?.data,
    };
  }
}

export async function publishInstagramMediaContainer(input: {
  businessAccountId: string;
  accessToken: string;
  creationId: string;
  apiVersion?: string;
}): Promise<{ success: boolean; postId?: string; error?: string; raw?: any }> {
  try {
    const businessAccountId = nonEmpty(input.businessAccountId);
    const accessToken = nonEmpty(input.accessToken);
    const apiVersion = nonEmpty(input.apiVersion || process.env.META_GRAPH_API_VERSION || process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0');

    if (!businessAccountId || !accessToken) {
      return { success: false, error: 'Instagram publishing credentials are not configured' };
    }

    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/media_publish`,
      {
        creation_id: input.creationId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.INSTAGRAM_TIMEOUT_MS || 30000),
      }
    );

    return {
      success: true,
      postId: response.data?.id,
      raw: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error?.message || error?.message || 'Failed to publish Instagram media',
      raw: error?.response?.data,
    };
  }
}

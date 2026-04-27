import { ensureCoreSchema, sql } from '@/lib/db';

interface InstagramCredentials {
    businessAccountId: string;
    accessToken: string;
    graphApiVersion: string;
}

/**
 * Resolves Instagram credentials from the database for the given workspace, 
 * falling back to environment variables.
 */
export async function resolveInstagramCredentials(workspaceId: string): Promise<InstagramCredentials> {
    await ensureCoreSchema();
    const rows = await sql`
    SELECT instagram_business_account_id, instagram_access_token
    FROM meta_apps
    WHERE workspace_id = ${workspaceId}
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `;

    const row = rows?.[0];
    const businessAccountId = row?.instagram_business_account_id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const accessToken = row?.instagram_access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
    const graphApiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v19.0';

    if (!businessAccountId || !accessToken) {
        throw new Error('Missing Instagram Business Account ID or Access Token.');
    }

    return {
        businessAccountId,
        accessToken,
        graphApiVersion,
    };
}

/**
 * Uploads and publishes an image to Instagram using the two-step process.
 */
export async function publishInstagramImage(workspaceId: string, imageUrl: string, caption?: string) {
    const creds = await resolveInstagramCredentials(workspaceId);

    // Step 1: Create a media container to get the Container ID (creation_id)
    const createContainerUrl = `https://graph.instagram.com/${creds.graphApiVersion}/${creds.businessAccountId}/media`;

    const containerParams = new URLSearchParams();
    containerParams.append('image_url', imageUrl);
    if (caption) {
        containerParams.append('caption', caption);
    }
    containerParams.append('access_token', creds.accessToken);

    const containerResponse = await fetch(`${createContainerUrl}?${containerParams.toString()}`, { method: 'POST' });
    const containerData = await containerResponse.json();

    if (!containerResponse.ok || !containerData.id) {
        throw new Error(`Failed to create media container: ${containerData.error?.message || JSON.stringify(containerData)}`);
    }

    const creationId = containerData.id;

    // Step 2: Publish the media container using the creation_id
    const publishUrl = `https://graph.instagram.com/${creds.graphApiVersion}/${creds.businessAccountId}/media_publish`;

    const publishParams = new URLSearchParams();
    publishParams.append('creation_id', creationId);
    publishParams.append('access_token', creds.accessToken);

    const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, { method: 'POST' });
    const publishData = await publishResponse.json();

    if (!publishResponse.ok || !publishData.id) {
        throw new Error(`Failed to publish media: ${publishData.error?.message || JSON.stringify(publishData)}`);
    }

    return publishData.id;
}
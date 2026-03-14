import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function requireUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

async function verifyWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  const owned = await sql`
    SELECT id
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;
  return Array.isArray(owned) && owned.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const authorizationCode = String(body?.authorizationCode || '').trim();
    const accountData = body?.accountData || {};

    if (!workspaceId || !authorizationCode) {
      return NextResponse.json(
        { error: 'workspaceId and authorizationCode are required' },
        { status: 400 }
      );
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get Meta app secret for token exchange
    let appSecret = process.env.META_APP_SECRET || '';
    let appId = process.env.META_APP_ID || '';
    let redirectUri = process.env.META_REDIRECT_URI || '';

    // Try to get workspace-specific config
    const metaApps = await sql`
      SELECT app_id, app_secret, redirect_uri
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;

    if (metaApps && metaApps.length > 0) {
      appId = metaApps[0].app_id || appId;
      appSecret = metaApps[0].app_secret || appSecret;
      redirectUri = metaApps[0].redirect_uri || redirectUri;
    }

    if (!appSecret || !appId) {
      return NextResponse.json(
        { error: 'Meta app configuration not properly set up' },
        { status: 400 }
      );
    }

    // Exchange authorization code for long-lived access token
    const tokenResponse = await fetch('https://graph.instagram.com/v20.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri || 'https://localhost:3000',
        code: authorizationCode,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('[v0] Token exchange failed:', error);
      return NextResponse.json(
        { error: `Token exchange failed: ${error.error?.message || 'Unknown error'}` },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token in response' },
        { status: 400 }
      );
    }

    // Get WhatsApp Business Account details
    let accountDetails: any = {
      phone_number: accountData.phone_number || '',
      account_name: accountData.account_name || 'WhatsApp Business Account',
      business_account_id: accountData.business_account_id || '',
      profile_picture_url: accountData.profile_picture_url || '',
    };

    try {
      // Fetch account info from Meta API
      const meResponse = await fetch(
        `https://graph.instagram.com/v20.0/me?fields=id,name,phone,picture.type(large)&access_token=${accessToken}`
      );

      if (meResponse.ok) {
        const meData = await meResponse.json();
        accountDetails = {
          ...accountDetails,
          account_id: meData.id,
          account_name: meData.name || accountDetails.account_name,
          phone_number: meData.phone || accountDetails.phone_number,
          profile_picture_url: meData.picture?.data?.url || accountDetails.profile_picture_url,
        };
      }
    } catch (err) {
      console.error('[v0] Failed to fetch account details:', err);
      // Continue with basic details
    }

    // Check if connection already exists
    const existing = await sql`
      SELECT id FROM integrations
      WHERE workspace_id = ${workspaceId} AND type = 'facebook_whatsapp'
      LIMIT 1
    `;

    const credentials = {
      access_token: accessToken,
      phone_number: accountDetails.phone_number,
      account_name: accountDetails.account_name,
      business_account_id: accountDetails.business_account_id,
    };

    const metadata = {
      phone_number: accountDetails.phone_number,
      account_name: accountDetails.account_name,
      business_account_id: accountDetails.business_account_id,
      profile_picture_url: accountDetails.profile_picture_url,
      connected_at: new Date().toISOString(),
      account_id: accountDetails.account_id,
    };

    if (existing && existing.length > 0) {
      // Update existing integration
      await sql`
        UPDATE integrations
        SET credentials = ${JSON.stringify(credentials)},
            metadata = ${JSON.stringify(metadata)},
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `;

      return NextResponse.json({
        success: true,
        message: 'WhatsApp account updated',
        connection: {
          id: existing[0].id,
          ...accountDetails,
          is_active: true,
        },
      });
    } else {
      // Create new integration
      const result = await sql`
        INSERT INTO integrations (workspace_id, type, credentials, metadata, is_active)
        VALUES (${workspaceId}, 'facebook_whatsapp', ${JSON.stringify(credentials)}, ${JSON.stringify(metadata)}, true)
        RETURNING id, created_at
      `;

      return NextResponse.json({
        success: true,
        message: 'WhatsApp account connected successfully',
        connection: {
          id: result[0].id,
          ...accountDetails,
          is_active: true,
        },
      });
    }
  } catch (error: any) {
    console.error('[v0] Callback error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

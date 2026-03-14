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

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const accessToken = url.searchParams.get('access_token');
    const phoneNumberId = url.searchParams.get('phone_number_id');
    const businessAccountId = url.searchParams.get('business_account_id');
    const code = url.searchParams.get('code');

    console.log('[v0] Embed callback received for workspace:', workspaceId);
    console.log('[v0] Access token present:', !!accessToken);
    console.log('[v0] Phone number ID:', phoneNumberId);
    console.log('[v0] Business account ID:', businessAccountId);

    // Verify user is logged in
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!workspaceId) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // If we have authorization code, exchange it for token
    let finalAccessToken = accessToken;
    if (code && !accessToken) {
      console.log('[v0] Exchanging authorization code for access token');
      // Get Meta app configuration
      let appId = process.env.META_APP_ID || '';
      let appSecret = process.env.META_APP_SECRET || '';

      const metaConfig = await sql`
        SELECT app_id, app_secret
        FROM meta_apps
        WHERE workspace_id = ${workspaceId}
        ORDER BY is_default DESC
        LIMIT 1
      `;

      if (metaConfig && metaConfig.length > 0) {
        appId = metaConfig[0].app_id || appId;
        appSecret = metaConfig[0].app_secret || appSecret;
      }

      if (appSecret && appId) {
        try {
          const tokenResponse = await fetch('https://graph.instagram.com/v20.0/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: appId,
              client_secret: appSecret,
              grant_type: 'authorization_code',
              code: code,
            }).toString(),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            finalAccessToken = tokenData.access_token;
            console.log('[v0] Successfully exchanged authorization code for token');
          }
        } catch (err) {
          console.error('[v0] Failed to exchange code for token:', err);
        }
      }
    }

    // Get account details from Meta API if we have access token
    let accountDetails = {
      phone_number: '',
      account_name: 'WhatsApp Business Account',
      business_account_id: businessAccountId || '',
      profile_picture_url: '',
      account_id: '',
    };

    if (finalAccessToken) {
      try {
        const meResponse = await fetch(
          `https://graph.instagram.com/v20.0/me?fields=id,name,phone,picture.type(large)&access_token=${finalAccessToken}`
        );

        if (meResponse.ok) {
          const meData = await meResponse.json();
          accountDetails = {
            ...accountDetails,
            account_id: meData.id || accountDetails.account_id,
            account_name: meData.name || accountDetails.account_name,
            phone_number: meData.phone || accountDetails.phone_number || phoneNumberId || '',
            profile_picture_url: meData.picture?.data?.url || accountDetails.profile_picture_url,
          };
          console.log('[v0] Fetched account details from Meta API');
        }
      } catch (err) {
        console.error('[v0] Failed to fetch account details:', err);
      }
    }

    // Save to database
    const credentials = {
      access_token: finalAccessToken || '',
      phone_number_id: phoneNumberId || '',
      business_account_id: businessAccountId || '',
    };

    const metadata = {
      ...accountDetails,
      connected_at: new Date().toISOString(),
    };

    // Check if connection already exists
    const existing = await sql`
      SELECT id FROM integrations
      WHERE workspace_id = ${workspaceId} AND type = 'facebook_whatsapp'
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      console.log('[v0] Updating existing WhatsApp connection');
      await sql`
        UPDATE integrations
        SET credentials = ${JSON.stringify(credentials)},
            metadata = ${JSON.stringify(metadata)},
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `;
    } else {
      console.log('[v0] Creating new WhatsApp connection');
      await sql`
        INSERT INTO integrations (workspace_id, type, credentials, metadata, is_active)
        VALUES (${workspaceId}, 'facebook_whatsapp', ${JSON.stringify(credentials)}, ${JSON.stringify(metadata)}, true)
      `;
    }

    console.log('[v0] WhatsApp connection saved successfully');

    // Redirect back to dashboard
    return NextResponse.redirect(new URL(`/dashboard?whatsapp=connected`, request.url));
  } catch (error: any) {
    console.error('[v0] Embed callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?whatsapp=error', request.url));
  }
}

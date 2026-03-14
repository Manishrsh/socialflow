import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('[v0] ===== WhatsApp OAuth Callback =====');

    await ensureCoreSchema();

    const url = new URL(request.url);

    const code = url.searchParams.get('code');
    const workspaceId = url.searchParams.get('state');

    console.log('[v0] OAuth params:', { code, workspaceId });

    if (!code || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing OAuth parameters' },
        { status: 400 }
      );
    }

    // Load Meta app configuration
    const metaApps = await sql`
      SELECT app_id, app_secret
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;

    let appId = process.env.META_APP_ID || '';
    let appSecret = process.env.META_APP_SECRET || '';

    if (metaApps && metaApps.length > 0) {
      appId = metaApps[0].app_id || appId;
      appSecret = metaApps[0].app_secret || appSecret;
    }

    const redirectUri =
      'https://socialflow-gxnk.vercel.app/api/integrations/facebook-whatsapp/embed-callback';

    console.log('[v0] Using Meta config:', { appId, redirectUri });

    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code: code,
        }).toString(),
      }
    );

    const tokenData = await tokenResponse.json();

    console.log('[v0] Token response:', tokenData);

    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: 'Failed to exchange token', details: tokenData },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // Get businesses
    const businessesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`
    );

    const businessesData = await businessesRes.json();

    console.log('[v0] Businesses:', businessesData);

    if (!businessesData.data || businessesData.data.length === 0) {
      return NextResponse.json(
        { error: 'No businesses found' },
        { status: 400 }
      );
    }

    const businessId = businessesData.data[0].id;

    // Get WhatsApp Business Accounts
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );

    const wabaData = await wabaRes.json();

    console.log('[v0] WABA accounts:', wabaData);

    if (!wabaData.data || wabaData.data.length === 0) {
      return NextResponse.json(
        { error: 'No WhatsApp Business accounts found' },
        { status: 400 }
      );
    }

    const wabaId = wabaData.data[0].id;

    // Get phone numbers
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}`
    );

    const phoneData = await phoneRes.json();

    console.log('[v0] Phone numbers:', phoneData);

    const phone = phoneData?.data?.[0] || {};

    const credentials = {
      access_token: accessToken,
      waba_id: wabaId,
      phone_number_id: phone.id,
      phone_number: phone.display_phone_number,
    };

    const metadata = {
      waba_id: wabaId,
      phone_number: phone.display_phone_number,
      phone_number_id: phone.id,
      connected_at: new Date().toISOString(),
    };

    // Check if integration exists
    const existing = await sql`
      SELECT id
      FROM integrations
      WHERE workspace_id = ${workspaceId}
      AND type = 'facebook_whatsapp'
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      await sql`
        UPDATE integrations
        SET credentials = ${JSON.stringify(credentials)},
            metadata = ${JSON.stringify(metadata)},
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `;

      console.log('[v0] Updated existing integration');

      return NextResponse.redirect(
        `https://socialflow-gxnk.vercel.app/dashboard?connected=true`
      );
    }

    const result = await sql`
      INSERT INTO integrations (workspace_id, type, credentials, metadata, is_active)
      VALUES (${workspaceId}, 'facebook_whatsapp', ${JSON.stringify(
      credentials
    )}, ${JSON.stringify(metadata)}, true)
      RETURNING id
    `;

    console.log('[v0] Created new integration:', result);

    return NextResponse.redirect(
      `https://socialflow-gxnk.vercel.app/dashboard?connected=true`
    );
  } catch (error: any) {
    console.error('[v0] OAuth callback error:', error);

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
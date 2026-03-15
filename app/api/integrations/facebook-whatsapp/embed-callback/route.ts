import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const url = new URL(request.url);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    console.log('WhatsApp OAuth callback hit');
    console.log('Code:', code);
    console.log('State:', state);

    if (!code) {
      return NextResponse.json(
        { error: 'Missing OAuth parameter: code is required' },
        { status: 400 }
      );
    }

    // Prefer workspace provided in state, else allow fallback from env or header.
    const defaultWorkspaceId = process.env.DEFAULT_WORKSPACE_ID || url.searchParams.get('workspaceId') || request.headers.get('x-workspace-id');
    const workspaceId = state?.trim() || defaultWorkspaceId?.trim();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace identifier. Please provide state=workspaceId or set DEFAULT_WORKSPACE_ID.' },
        { status: 400 }
      );
    }

    // Validate UUID format for workspace ID to avoid DB parse errors.
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json(
        { error: 'Invalid workspaceId format; expect UUID string.' },
        { status: 400 }
      );
    }

    // Load Meta app config
    let appId = process.env.META_APP_ID || "";
    let appSecret = process.env.META_APP_SECRET || "";

    const metaConfig = await sql`
      SELECT app_id, app_secret
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC
      LIMIT 1
    `;

    if (metaConfig.length > 0) {
      appId = metaConfig[0].app_id || appId;
      appSecret = metaConfig[0].app_secret || appSecret;
    }

    const redirectUri =
      "https://socialflow-gxnk.vercel.app/api/integrations/facebook-whatsapp/embed-callback";

    // Exchange OAuth code for token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token`,
      {
        method: "GET",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
      }
    );

    const tokenData = await tokenResponse.json();

    console.log("[v0] Token exchange response:", tokenData);

    if (!tokenData.access_token) {
      return NextResponse.json(
        {
          error: 'Failed to get access token',
          metaError: tokenData,
          redirectUrl: '/dashboard?whatsapp=error'
        },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // Get businesses
    const businessesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`
    );

    const businessesData = await businessesRes.json();

    if (!businessesData.data || businessesData.data.length === 0) {
      console.log("[v0] No businesses found");
      return NextResponse.json(
        { error: 'No businesses found', redirectUrl: '/dashboard?whatsapp=error' },
        { status: 400 }
      );
    }

    const businessId = businessesData.data[0].id;

    // Get WABA
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );

    const wabaData = await wabaRes.json();

    if (!wabaData.data || wabaData.data.length === 0) {
      console.log("[v0] No WABA found");
      return NextResponse.json(
        { error: 'No WABA found', redirectUrl: '/dashboard?whatsapp=error' },
        { status: 400 }
      );
    }

    const wabaId = wabaData.data[0].id;

    // Get phone numbers
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}`
    );

    const phoneData = await phoneRes.json();

    const phone = phoneData?.data?.[0];

    const credentials = {
      access_token: accessToken,
      waba_id: wabaId,
      phone_number_id: phone?.id || "",
      phone_number: phone?.display_phone_number || "",
    };

    const metadata = {
      waba_id: wabaId,
      phone_number_id: phone?.id || "",
      phone_number: phone?.display_phone_number || "",
      connected_at: new Date().toISOString(),
    };

    const existing = await sql`
      SELECT id FROM integrations
      WHERE workspace_id = ${workspaceId}
      AND type = 'facebook_whatsapp'
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE integrations
        SET credentials = ${JSON.stringify(credentials)},
            metadata = ${JSON.stringify(metadata)},
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO integrations (workspace_id, type, credentials, metadata, is_active)
        VALUES (${workspaceId}, 'facebook_whatsapp',
        ${JSON.stringify(credentials)},
        ${JSON.stringify(metadata)}, true)
      `;
    }

    console.log("[v0] WhatsApp integration saved");

    return NextResponse.json({
      success: true,
      message: 'WhatsApp integration saved',
      redirectUrl: '/dashboard?whatsapp=connected'
    });
  } catch (error) {
    console.error("[v0] OAuth callback error:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage, redirectUrl: '/dashboard?whatsapp=error' },
      { status: 500 }
    );
  }
}
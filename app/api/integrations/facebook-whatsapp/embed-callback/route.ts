import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const workspaceId = url.searchParams.get("state");

    console.log("[v0] OAuth callback received");
    console.log("[v0] Code:", code);
    console.log("[v0] WorkspaceId:", workspaceId);

    if (!code || !workspaceId) {
      return NextResponse.redirect(new URL("/dashboard?whatsapp=error", request.url));
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
        method: "POST",
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
      return NextResponse.redirect(new URL("/dashboard?whatsapp=error", request.url));
    }

    const accessToken = tokenData.access_token;

    // Get businesses
    const businessesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`
    );

    const businessesData = await businessesRes.json();

    if (!businessesData.data || businessesData.data.length === 0) {
      console.log("[v0] No businesses found");
      return NextResponse.redirect(new URL("/dashboard?whatsapp=error", request.url));
    }

    const businessId = businessesData.data[0].id;

    // Get WABA
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );

    const wabaData = await wabaRes.json();

    if (!wabaData.data || wabaData.data.length === 0) {
      console.log("[v0] No WABA found");
      return NextResponse.redirect(new URL("/dashboard?whatsapp=error", request.url));
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

    return NextResponse.redirect(
      new URL("/dashboard?whatsapp=connected", request.url)
    );
  } catch (error) {
    console.error("[v0] OAuth callback error:", error);

    return NextResponse.redirect(
      new URL("/dashboard?whatsapp=error", request.url)
    );
  }
}
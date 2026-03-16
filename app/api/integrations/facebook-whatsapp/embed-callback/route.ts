import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    console.log('[v0] WhatsApp OAuth callback hit');

    if (!code) {
      return new NextResponse(
        `<html><body><h2>Missing OAuth code parameter</h2><p>Please close this window and try again.</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const workspaceId = state?.trim();

    if (!workspaceId) {
      return new NextResponse(
        `<html><body><h2>Missing workspace identifier in state</h2><p>Please close this window and try again.</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    await ensureCoreSchema();

    let appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    let appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return new NextResponse(
        `<html><body><h2>Server missing Meta credentials</h2><p>Please check your environment variables.</p></body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('[v0] Exchanging authorization code for business token for workspace:', workspaceId);

    // The redirect URI sent in the token exchange must exactly match the one used during popup launch
    const redirectUri = `${url.origin}/api/integrations/facebook-whatsapp/embed-callback`;
    console.log('[v0] Using token exchange redirect URI:', redirectUri);

    // Step 1: Exchange code for business token
    const tokenResponse = await fetch(
      'https://graph.facebook.com/v21.0/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code: code
        }).toString(),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[v0] Token exchange failed:', tokenData.error);
      return new NextResponse(
        `<html><body><h2>Facebook Token Exchange Failed</h2><p>${tokenData.error.message}</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!tokenData.access_token) {
      console.error('[v0] No access token in response');
      return new NextResponse(
        `<html><body><h2>No access token received from Facebook</h2></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('[v0] Token exchange successful, fetching account details');
    const accessToken = tokenData.access_token;

    // Get businesses
    const businessesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`
    );
    const businessesData = await businessesRes.json();

    if (!businessesData.data || businessesData.data.length === 0) {
      return new NextResponse(
        `<html><body><h2>No businesses found for this account.</h2><p>Please ensure you complete the business setup.</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }
    const businessId = businessesData.data[0].id;

    // Get WABA
    const wabaRes = await fetch(
      `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );
    const wabaData = await wabaRes.json();

    if (!wabaData.data || wabaData.data.length === 0) {
      return new NextResponse(
        `<html><body><h2>No WhatsApp Business Account found.</h2><p>Please ensure you complete the setup.</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }
    const wabaId = wabaData.data[0].id;

    // Get phone numbers
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`
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

    console.log("[v0] WhatsApp integration saved successfully via embed callback!");

    // Return HTML that posts the success message back to the parent and closes the popup
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WhatsApp Connected Successfully</title>
          <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0fdf4; color: #166534; flex-direction: column; }
              .spinner { border: 4px solid rgba(0,0,0,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #166534; animation: spin 1s linear infinite; margin-top: 20px;}
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
      </head>
      <body>
          <h2>WhatsApp Connected!</h2>
          <p>Saving configuration...</p>
          <div class="spinner"></div>
          <script>
              // Send message to parent window
              if (window.opener) {
                  window.opener.postMessage({ type: 'WA_CALLBACK_SUCCESS' }, '*');
              }
              // Close the popup after a brief delay
              setTimeout(function() {
                  window.close();
              }, 1500);
          </script>
      </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error('[v0] OAuth callback error:', error);
    return new NextResponse(
      `<html><body><h2>Internal Server Error</h2><p>${error?.message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { code, workspaceId } = await request.json();

        if (!code) {
            return NextResponse.json(
                { error: 'Authorization code is required' },
                { status: 400 }
            );
        }

        if (!workspaceId) {
            return NextResponse.json(
                { error: 'Workspace ID is required' },
                { status: 400 }
            );
        }

        await ensureCoreSchema();

        let appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        let appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

        if (!appId || !appSecret) {
            return NextResponse.json(
                { error: 'Missing Facebook credentials in environment variables' },
                { status: 500 }
            );
        }

        console.log('[v0] Exchanging authorization code for business token');

        // Get the actual request origin for redirect URI
        const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://localhost:3000';
        const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || origin;

        console.log('[v0] Using redirect URI:', redirectUri);

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
                    code: code
                }).toString(),
            }
        );

        const tokenData = await tokenResponse.json();
        console.log('[v0] Token exchange response:', { success: !tokenData.error, hasError: !!tokenData.error });

        if (tokenData.error) {
            console.error('[v0] Token exchange failed:', tokenData.error);
            return NextResponse.json(
                {
                    error: tokenData.error.message || 'Failed to exchange token',
                    details: tokenData.error
                },
                { status: 400 }
            );
        }

        if (!tokenData.access_token) {
            console.error('[v0] No access token in response');
            return NextResponse.json(
                { error: 'No access token received from Facebook' },
                { status: 400 }
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
            return NextResponse.json({ error: 'No businesses found for this account' }, { status: 400 });
        }
        const businessId = businessesData.data[0].id;

        // Get WABA
        const wabaRes = await fetch(
            `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
        );
        const wabaData = await wabaRes.json();

        if (!wabaData.data || wabaData.data.length === 0) {
            return NextResponse.json({ error: 'No WhatsApp Business Account found' }, { status: 400 });
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

        console.log("[v0] WhatsApp integration saved via code exchange");

        return NextResponse.json({
            success: true,
            businessToken: accessToken,
            message: 'Token exchanged and integration saved successfully',
        });
    } catch (error: any) {
        console.error('[v0] Token exchange error:', error);
        return NextResponse.json(
            { error: `Internal server error: ${error.message}` },
            { status: 500 }
        );
    }
}

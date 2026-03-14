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

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    // Get the integration
    const rows = await sql`
      SELECT workspace_id, credentials, metadata
      FROM integrations
      WHERE id = ${connectionId}
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const integration = rows[0];
    const credentials = integration.credentials as any;
    const metadata = integration.metadata as any;

    if (!credentials?.access_token) {
      return NextResponse.json({ error: 'No access token found' }, { status: 400 });
    }

    // Verify the token with Meta API
    try {
      const response = await fetch(
        `https://graph.instagram.com/v20.0/me?fields=id,name,phone&access_token=${credentials.access_token}`
      );

      if (!response.ok) {
        // Token is invalid or expired
        await sql`
          UPDATE integrations
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${connectionId}
        `;

        return NextResponse.json({ error: 'Token is invalid or expired' }, { status: 401 });
      }

      const data = await response.json();

      // Update metadata with latest info
      const updatedMetadata = {
        ...metadata,
        verified_at: new Date().toISOString(),
        account_id: data.id,
        account_name: data.name || metadata?.account_name,
        phone_number: data.phone || metadata?.phone_number,
      };

      await sql`
        UPDATE integrations
        SET metadata = ${JSON.stringify(updatedMetadata)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${connectionId}
      `;

      return NextResponse.json({
        success: true,
        connection: {
          id: connectionId,
          phone_number: updatedMetadata.phone_number || credentials?.phone_number || '',
          account_name: updatedMetadata.account_name || credentials?.account_name || '',
          business_account_id: credentials?.business_account_id || '',
          access_token: credentials?.access_token || '',
          is_active: true,
          profile_picture_url: updatedMetadata?.profile_picture_url || '',
        },
      });
    } catch (err) {
      console.error('[v0] Failed to verify token with Meta API:', err);
      return NextResponse.json({ error: 'Failed to verify connection with Meta' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[v0] Verify error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

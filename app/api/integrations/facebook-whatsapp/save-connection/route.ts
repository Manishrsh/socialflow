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
    const { workspaceId, accountData } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('[v0] Saving WhatsApp connection with account data:', accountData);

    // Prepare connection data
    const credentials = {
      phone_number_id: accountData.phone_number_id || '',
      business_account_id: accountData.business_account_id || '',
      access_token: accountData.access_token || '',
    };

    const metadata = {
      phone_number: accountData.phone_number || '',
      account_name: accountData.account_name || 'WhatsApp Business Account',
      business_account_id: accountData.business_account_id || '',
      profile_picture_url: accountData.profile_picture_url || '',
      connected_at: new Date().toISOString(),
      account_id: accountData.account_id || '',
    };

    // Check if connection already exists
    const existing = await sql`
      SELECT id FROM integrations
      WHERE workspace_id = ${workspaceId} AND type = 'facebook_whatsapp'
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      // Update existing integration
      console.log('[v0] Updating existing WhatsApp connection');
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
          ...metadata,
          is_active: true,
        },
      });
    } else {
      // Create new integration
      console.log('[v0] Creating new WhatsApp connection');
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
          ...metadata,
          is_active: true,
        },
      });
    }
  } catch (error: any) {
    console.error('[v0] Save connection error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

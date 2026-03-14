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
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    // Get WhatsApp connection from integrations table
    const rows = await sql`
      SELECT id, type, credentials, metadata, is_active, created_at, updated_at
      FROM integrations
      WHERE workspace_id = ${workspaceId} AND type = 'facebook_whatsapp' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ connection: null });
    }

    const integration = rows[0];
    const credentials = integration.credentials as any;
    const metadata = integration.metadata as any;

    return NextResponse.json({
      connection: {
        id: integration.id,
        phone_number: metadata?.phone_number || credentials?.phone_number || '',
        account_name: metadata?.account_name || credentials?.account_name || '',
        business_account_id: credentials?.business_account_id || '',
        access_token: credentials?.access_token || '',
        connected_at: integration.created_at,
        profile_picture_url: metadata?.profile_picture_url || '',
        is_active: integration.is_active,
      },
    });
  } catch (error: any) {
    console.error('[v0] WhatsApp GET error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const connectionId = url.pathname.split('/').pop();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    // Get the integration to verify ownership
    const rows = await sql`
      SELECT workspace_id FROM integrations WHERE id = ${connectionId}
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const workspaceId = rows[0].workspace_id;
    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Revoke token with Meta API if access token exists
    const integration = await sql`
      SELECT credentials FROM integrations WHERE id = ${connectionId}
    `;

    if (integration && integration.length > 0) {
      const credentials = integration[0].credentials as any;
      if (credentials?.access_token) {
        try {
          // Revoke the token with Meta API
          await fetch(`https://graph.instagram.com/me/permissions?access_token=${credentials.access_token}`, {
            method: 'DELETE',
          });
        } catch (err) {
          console.error('[v0] Failed to revoke token:', err);
          // Continue with deletion even if revocation fails
        }
      }
    }

    // Mark as inactive instead of deleting
    await sql`
      UPDATE integrations
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${connectionId}
    `;

    return NextResponse.json({ success: true, message: 'WhatsApp account disconnected' });
  } catch (error: any) {
    console.error('[v0] WhatsApp DELETE error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const subscription = body?.subscription;
    const endpoint = String(subscription?.endpoint || '').trim();

    if (!workspaceId || !endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    await sql`
      INSERT INTO push_subscriptions (workspace_id, user_id, endpoint, subscription)
      VALUES (${workspaceId}, ${userId}, ${endpoint}, ${JSON.stringify(subscription)})
      ON CONFLICT (endpoint)
      DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        user_id = EXCLUDED.user_id,
        subscription = EXCLUDED.subscription,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '').trim();

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    await sql`
      DELETE FROM push_subscriptions
      WHERE endpoint = ${endpoint} AND user_id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}

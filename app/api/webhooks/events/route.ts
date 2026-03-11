import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { sql, ensureCoreSchema } from '@/lib/db';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const provider = (searchParams.get('provider') || '').trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 20)));
    const offset = (page - 1) * limit;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const rows = provider
      ? await sql`
          SELECT id, provider, event_type, payload, received_at
          FROM webhook_events
          WHERE workspace_id = ${workspaceId} AND LOWER(provider) = ${provider}
          ORDER BY received_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT id, provider, event_type, payload, received_at
          FROM webhook_events
          WHERE workspace_id = ${workspaceId}
          ORDER BY received_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

    const totalRows = provider
      ? await sql`
          SELECT COUNT(*)::int AS count
          FROM webhook_events
          WHERE workspace_id = ${workspaceId} AND LOWER(provider) = ${provider}
        `
      : await sql`
          SELECT COUNT(*)::int AS count
          FROM webhook_events
          WHERE workspace_id = ${workspaceId}
        `;

    const events = rows.map((row: any) => ({
      ...row,
      payload:
        typeof row.payload === 'string'
          ? JSON.parse(row.payload || '{}')
          : (row.payload || {}),
    }));

    return NextResponse.json({
      success: true,
      events,
      page,
      limit,
      total: Number(totalRows?.[0]?.count || 0),
    });
  } catch (error: any) {
    console.error('Webhook events list error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

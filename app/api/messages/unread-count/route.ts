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
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const unreadRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND direction = 'inbound'
        AND read_at IS NULL
    `;

    return NextResponse.json({
      success: true,
      unreadCount: Number(unreadRows?.[0]?.total || 0),
    });
  } catch (error: any) {
    console.error('Unread count fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

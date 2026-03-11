import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const workspaceId = String(body?.workspaceId || '');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT o.id
      FROM own_bsp_outbox o
      INNER JOIN workspaces ws ON o.workspace_id = ws.id
      WHERE o.id = ${id} AND o.workspace_id = ${workspaceId} AND ws.owner_id = ${userId}
      LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Outbox item not found' }, { status: 404 });
    }

    await sql`
      UPDATE own_bsp_outbox
      SET status = ${'queued'}, error = ${null}, provider_message_id = ${null}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, message: 'Outbox item re-queued' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Retry failed' },
      { status: 500 }
    );
  }
}

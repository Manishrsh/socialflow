import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { processOutboxItem } from '@/lib/own-bsp-service';

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

    const result = await processOutboxItem(id);
    if (!result.success && result.status === 'failed') {
      return NextResponse.json(
        { success: false, status: result.status, error: result.error || 'Process failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      providerMessageId: result.providerMessageId || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Process failed' },
      { status: 500 }
    );
  }
}

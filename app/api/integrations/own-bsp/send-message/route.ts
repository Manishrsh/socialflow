import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { getOwnBspRuntimeInfo, queueOwnBspMessage } from '@/lib/own-bsp-service';

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
    const workspaceId = String(body?.workspaceId || '');
    const phone = String(body?.phone || '').trim();
    const message = String(body?.message || '').trim();
    const channel = (String(body?.channel || 'whatsapp').toLowerCase() === 'instagram'
      ? 'instagram'
      : 'whatsapp') as 'whatsapp' | 'instagram';

    if (!workspaceId || !phone || !message) {
      return NextResponse.json(
        { error: 'workspaceId, phone and message are required' },
        { status: 400 }
      );
    }

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const result = await queueOwnBspMessage({
      workspaceId,
      channel,
      recipient: phone,
      message,
      payload: { source: 'integrations_test_send' },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Queue failed' }, { status: 500 });
    }

    const runtime = await getOwnBspRuntimeInfo(workspaceId);

    return NextResponse.json({
      success: true,
      data: result,
      runtime,
      warning:
        result.status !== 'sent'
          ? 'Message is queued but not delivered yet. Configure OWN_BSP_PROVIDER_SEND_URL for real delivery.'
          : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to queue test message' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { sql, ensureCoreSchema } from '@/lib/db';
import { randomUUID } from 'crypto';
import { queueOwnBspMessage } from '@/lib/own-bsp-service';

function parseMetadata(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
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

    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT c.id
      FROM customers c
      INNER JOIN workspaces ws ON c.workspace_id = ws.id
      WHERE c.id = ${customerId}
        AND c.workspace_id = ${workspaceId}
        AND ws.owner_id = ${userId}
      LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const rows = await sql`
      SELECT id, content, media_url, direction, type, sent_at, read_at
      FROM messages
      WHERE workspace_id = ${workspaceId} AND customer_id = ${customerId}
      ORDER BY sent_at ASC
      LIMIT 500
    `;

    const messages = rows.map((r: any) => ({
      id: r.id,
      content: r.content || '',
      mediaUrl: r.media_url || null,
      direction: r.direction || 'inbound',
      type: r.type || 'text',
      sentAt: r.sent_at,
      readAt: r.read_at || null,
    }));

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Thread messages fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { pusherServer } from '@/lib/pusher';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
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

    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const body = await request.json();
    const messageText = String(body?.message || '').trim();
    if (!messageText) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const customerRows = await sql`
      SELECT c.id, c.phone, c.metadata
      FROM customers c
      INNER JOIN workspaces ws ON c.workspace_id = ws.id
      WHERE c.id = ${customerId}
        AND c.workspace_id = ${workspaceId}
        AND ws.owner_id = ${userId}
      LIMIT 1
    `;
    if (!customerRows || customerRows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const customer = customerRows[0];
    const metadata = parseMetadata(customer.metadata);
    const provider = String(metadata.provider || 'whatsapp').toLowerCase();

    const channel = provider === 'instagram' ? 'instagram' : 'whatsapp';
    const sendResult = await queueOwnBspMessage({
      workspaceId,
      channel,
      recipient: String(customer.phone),
      message: messageText,
      payload: {
        source: 'inbox_reply',
        customerId,
      },
    });
    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to queue reply' },
        { status: 500 }
      );
    }

    const insertedRows = await sql`
      INSERT INTO messages (id, workspace_id, customer_id, direction, type, content, media_url)
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${customerId},
        ${'outbound'},
        ${'text'},
        ${messageText},
        ${null}
      )
      RETURNING id, content, media_url, direction, type, sent_at, read_at
    `;

    const newMsg = insertedRows[0];
    
    // Trigger real-time update
    try {
        await pusherServer.trigger(`workspace-${workspaceId}`, 'new-message', {
            id: newMsg.id,
            customerId: customerId,
            content: newMsg.content || '',
            mediaUrl: newMsg.media_url || null,
            direction: newMsg.direction || 'outbound',
            type: newMsg.type || 'text',
            sentAt: newMsg.sent_at,
            readAt: newMsg.read_at || null,
        });
    } catch (e) {
        console.error('Failed to trigger Pusher event:', e);
    }

    return NextResponse.json({
      success: true,
      outboxId: sendResult.outboxId || null,
      provider,
      response: sendResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send reply',
      },
      { status: 500 }
    );
  }
}

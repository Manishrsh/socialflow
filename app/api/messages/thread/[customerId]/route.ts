import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { sql, ensureCoreSchema } from '@/lib/db';
import { randomUUID } from 'crypto';
import { queueOwnBspMessage } from '@/lib/own-bsp-service';
import { getPublicOrigin, normalizePublicUrl } from '@/lib/public-url';
import { pusherServer } from '@/lib/pusher';

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

function normalizePhone(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
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
    const requestedPhone = normalizePhone(searchParams.get('phone'));
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const ownedRows = await sql`
      SELECT c.id, c.phone
      FROM customers c
      INNER JOIN workspaces ws ON c.workspace_id = ws.id
      WHERE c.id = ${customerId}
        AND c.workspace_id = ${workspaceId}
        AND ws.owner_id = ${userId}
      LIMIT 1
    `;
    if (!ownedRows || ownedRows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const normalizedPhone = requestedPhone || normalizePhone(ownedRows[0].phone);
    const publicOrigin = getPublicOrigin(request);

    const rows = await sql`
      SELECT m.id, m.content, m.media_url, m.direction, m.type, m.sent_at, m.read_at
      FROM messages m
      INNER JOIN customers c ON c.id = m.customer_id
      WHERE m.workspace_id = ${workspaceId}
        AND c.workspace_id = ${workspaceId}
        AND (
          m.customer_id = ${customerId}
          OR ${normalizedPhone || ''} = ''
          OR replace(
            regexp_replace(
              regexp_replace(lower(COALESCE(c.phone, '')), '^whatsapp:', ''),
              '[^0-9+]',
              '',
              'g'
            ),
            '+',
            ''
          ) = ${normalizedPhone || ''}
        )
      ORDER BY m.sent_at DESC, m.id DESC
      LIMIT 150
    `;

    const messages = rows.map((r: any) => ({
      id: r.id,
      content: r.content || '',
      mediaUrl: normalizePublicUrl(r.media_url || null, publicOrigin),
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
    const publicOrigin = getPublicOrigin(request);

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

    try {
      await pusherServer.trigger(`workspace-${workspaceId}`, 'new-message', {
        id: newMsg.id,
        customerId,
        phone: String(customer.phone || ''),
        name: metadata.name || null,
        source: provider,
        content: newMsg.content || '',
        mediaUrl: normalizePublicUrl(newMsg.media_url || null, publicOrigin),
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
      messageId: newMsg.id,
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

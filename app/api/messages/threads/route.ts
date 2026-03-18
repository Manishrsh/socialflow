import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { sql, ensureCoreSchema } from '@/lib/db';

function parseMetadata(metadata: any): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata;
}

function normalizePhone(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
}

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
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const provider = (searchParams.get('provider') || '').trim().toLowerCase();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const rows = await sql`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.metadata AS customer_metadata,
        COALESCE(unread.unread_count, 0) AS unread_count,
        m.id AS message_id,
        m.content,
        m.media_url,
        m.direction,
        m.type,
        m.sent_at
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT id, content, media_url, direction, type, sent_at
        FROM messages
        WHERE customer_id = c.id
          AND workspace_id = ${workspaceId}
        ORDER BY sent_at DESC, id DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages
        WHERE customer_id = c.id
          AND workspace_id = ${workspaceId}
          AND direction = 'inbound'
          AND read_at IS NULL
      ) unread ON true
      WHERE c.workspace_id = ${workspaceId}
      ORDER BY m.sent_at DESC NULLS LAST, c.created_at DESC
      LIMIT 400
    `;

    const rawThreads = rows.map((r: any) => {
      const metadata = parseMetadata(r.customer_metadata);
      const source = String(metadata.provider || 'unknown').toLowerCase();
      return {
        customerId: r.customer_id,
        name: r.customer_name || 'Unknown',
        phone: r.customer_phone || '',
        source,
        lastMessage: r.content || (r.media_url ? '[Media]' : ''),
        lastMessageType: r.type || 'text',
        direction: r.direction || null,
        lastMessageAt: r.sent_at || null,
        unreadCount: Number(r.unread_count || 0),
      };
    });

    const dedupedByPhone = new Map<string, (typeof rawThreads)[number]>();
    for (const thread of rawThreads) {
      const normalizedPhone = normalizePhone(thread.phone) || `customer:${thread.customerId}`;
      const existing = dedupedByPhone.get(normalizedPhone);
      if (!existing) {
        dedupedByPhone.set(normalizedPhone, thread);
        continue;
      }

      const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
      const currentTime = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
      if (currentTime >= existingTime) {
        dedupedByPhone.set(normalizedPhone, thread);
      }
    }

    let threads = Array.from(dedupedByPhone.values()).sort((a, b) => {
      const timeDiff =
        (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0) -
        (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name);
    });

    if (provider) {
      threads = threads.filter((t) => t.source === provider);
    }

    if (q) {
      threads = threads.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.phone.toLowerCase().includes(q) ||
          t.lastMessage.toLowerCase().includes(q)
      );
    }

    const totalUnread = threads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0);

    return NextResponse.json({ success: true, threads, totalUnread });
  } catch (error: any) {
    console.error('Threads fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

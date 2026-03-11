import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { randomUUID } from 'crypto';
import { queueOwnBspMessage } from '@/lib/own-bsp-service';

async function authUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

function parseTags(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // ignore json parse failure
    }
    return trimmed.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await authUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    const recipientTag = String(body?.recipientTag || '').trim().toLowerCase();

    if (!workspaceId || !title || !message) {
      return NextResponse.json({ error: 'workspaceId, title and message are required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const customerRows = await sql`
      SELECT id, phone, tags
      FROM customers
      WHERE workspace_id = ${workspaceId}
      LIMIT 10000
    `;

    const recipients = (customerRows || []).filter((c: any) => {
      if (!recipientTag) return true;
      const tags = parseTags(c.tags);
      return tags.includes(recipientTag);
    });

    let sentCount = 0;
    for (const customer of recipients) {
      const result = await queueOwnBspMessage({
        workspaceId,
        channel: 'whatsapp',
        recipient: String(customer.phone || ''),
        message,
        payload: {
          source: 'broadcast',
          title,
          customerId: customer.id,
        },
      });
      if (result.success) sentCount += 1;
    }

    const campaignId = randomUUID();
    await sql`
      INSERT INTO broadcast_campaigns (id, workspace_id, title, message, recipient_tag, status, recipient_count, sent_at)
      VALUES (
        ${campaignId},
        ${workspaceId},
        ${title},
        ${message},
        ${recipientTag || null},
        ${'sent'},
        ${sentCount},
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      success: true,
      data: {
        id: campaignId,
        status: 'sent',
        recipientCount: sentCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create broadcast' }, { status: 500 });
  }
}

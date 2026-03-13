import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { sql, ensureCoreSchema } from '@/lib/db';

function csvEscape(value: unknown) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return new NextResponse('Invalid session', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const customerId = searchParams.get('customerId');

    if (!workspaceId) {
      return new NextResponse('workspaceId is required', { status: 400 });
    }

    const owned = await sql`
      SELECT id
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;

    if (!owned || owned.length === 0) {
      return new NextResponse('Workspace not found', { status: 404 });
    }

    const rows = customerId
      ? await sql`
          SELECT
            m.id,
            c.name AS customer_name,
            c.phone AS customer_phone,
            m.direction,
            m.type,
            m.content,
            m.media_url,
            m.sent_at,
            m.read_at
          FROM messages m
          INNER JOIN customers c ON m.customer_id = c.id
          WHERE m.workspace_id = ${workspaceId} AND m.customer_id = ${customerId}
          ORDER BY m.sent_at ASC
        `
      : await sql`
          SELECT
            m.id,
            c.name AS customer_name,
            c.phone AS customer_phone,
            m.direction,
            m.type,
            m.content,
            m.media_url,
            m.sent_at,
            m.read_at
          FROM messages m
          INNER JOIN customers c ON m.customer_id = c.id
          WHERE m.workspace_id = ${workspaceId}
          ORDER BY m.sent_at DESC
          LIMIT 5000
        `;

    const headers = [
      'message_id',
      'customer_name',
      'customer_phone',
      'direction',
      'type',
      'content',
      'media_url',
      'sent_at',
      'read_at',
    ];

    const lines = [
      headers.join(','),
      ...rows.map((row: any) =>
        [
          row.id,
          row.customer_name || '',
          row.customer_phone || '',
          row.direction || '',
          row.type || '',
          row.content || '',
          row.media_url || '',
          row.sent_at ? new Date(row.sent_at).toISOString() : '',
          row.read_at ? new Date(row.read_at).toISOString() : '',
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];

    const filename = customerId ? `messages-${customerId}.csv` : `messages-${workspaceId}.csv`;

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new NextResponse(error?.message || 'Failed to export messages', { status: 500 });
  }
}

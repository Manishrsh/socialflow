import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

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
    const status = (searchParams.get('status') || '').trim().toLowerCase();
    const channel = (searchParams.get('channel') || '').trim().toLowerCase();
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 25)));
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

    const rows = await sql`
      SELECT id, channel, recipient, message, media_url, message_type, payload, status, provider_message_id, error, created_at, sent_at
      FROM own_bsp_outbox
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT 500
    `;

    let filtered = rows as any[];
    if (status) filtered = filtered.filter((r) => String(r.status || '').toLowerCase() === status);
    if (channel) filtered = filtered.filter((r) => String(r.channel || '').toLowerCase() === channel);
    if (q) {
      filtered = filtered.filter((r) =>
        String(r.recipient || '').toLowerCase().includes(q) ||
        String(r.message || '').toLowerCase().includes(q) ||
        String(r.error || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const start = Math.max(0, offset);
    const end = start + limit;
    const data = filtered.slice(start, end).map((r) => ({
      ...r,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : (r.payload || {}),
    }));

    return NextResponse.json({
      success: true,
      items: data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch outbox' },
      { status: 500 }
    );
  }
}

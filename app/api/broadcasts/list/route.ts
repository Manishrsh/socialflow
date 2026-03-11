import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function authUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await authUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const rows = await sql`
      SELECT id, title, message, recipient_tag, status, recipient_count, schedule_time, created_at, sent_at
      FROM broadcast_campaigns
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return NextResponse.json({ success: true, broadcasts: rows || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to list broadcasts' }, { status: 500 });
  }
}

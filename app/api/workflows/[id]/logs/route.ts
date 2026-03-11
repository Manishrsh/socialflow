import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const limit = Math.max(1, Math.min(50, Number(new URL(request.url).searchParams.get('limit') || 20)));

    const rows = await sql`
      SELECT l.id, l.phone, l.trigger_source, l.status, l.executed_nodes, l.summary, l.details, l.created_at, l.updated_at
      FROM workflow_execution_logs l
      INNER JOIN workflows w ON l.workflow_id = w.id
      INNER JOIN workspaces ws ON w.workspace_id = ws.id
      WHERE l.workflow_id = ${id} AND ws.owner_id = ${userId}
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      success: true,
      logs: rows.map((row: any) => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details || '{}') : (row.details || {}),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load workflow logs' },
      { status: 500 }
    );
  }
}

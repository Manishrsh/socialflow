import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';

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
    const workflowId = searchParams.get('workflowId');
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 50)));

    const rows = workflowId
      ? await sql`
          SELECT
            l.id,
            l.workflow_id,
            w.name AS workflow_name,
            l.phone,
            l.trigger_source,
            l.status,
            l.executed_nodes,
            l.summary,
            l.details,
            l.created_at,
            l.updated_at
          FROM workflow_execution_logs l
          INNER JOIN workflows w ON l.workflow_id = w.id
          INNER JOIN workspaces ws ON w.workspace_id = ws.id
          WHERE ws.owner_id = ${userId} AND l.workflow_id = ${workflowId}
          ORDER BY l.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            l.id,
            l.workflow_id,
            w.name AS workflow_name,
            l.phone,
            l.trigger_source,
            l.status,
            l.executed_nodes,
            l.summary,
            l.details,
            l.created_at,
            l.updated_at
          FROM workflow_execution_logs l
          INNER JOIN workflows w ON l.workflow_id = w.id
          INNER JOIN workspaces ws ON w.workspace_id = ws.id
          WHERE ws.owner_id = ${userId}
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
      { success: false, error: error?.message || 'Failed to load execution logs' },
      { status: 500 }
    );
  }
}

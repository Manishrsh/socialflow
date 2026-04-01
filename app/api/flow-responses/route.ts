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
    const workspaceId = String(searchParams.get('workspaceId') || '').trim();
    const status = String(searchParams.get('status') || '').trim().toLowerCase();
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const workspaceRows = await sql`
      SELECT id
      FROM workspaces
      WHERE id = ${workspaceId}
        AND owner_id = ${userId}
      LIMIT 1
    `;

    if (!workspaceRows || workspaceRows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const rows = status
      ? await sql`
          SELECT
            ab.*,
            c.name AS customer_name,
            wf.name AS flow_name
          FROM appointment_bookings ab
          LEFT JOIN customers c ON ab.customer_id = c.id
          LEFT JOIN whatsapp_flows wf ON ab.flow_id = wf.meta_flow_id AND ab.workspace_id = wf.workspace_id
          WHERE ab.workspace_id = ${workspaceId}
            AND LOWER(COALESCE(ab.status, '')) = ${status}
          ORDER BY ab.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            ab.*,
            c.name AS customer_name,
            wf.name AS flow_name
          FROM appointment_bookings ab
          LEFT JOIN customers c ON ab.customer_id = c.id
          LEFT JOIN whatsapp_flows wf ON ab.flow_id = wf.meta_flow_id AND ab.workspace_id = wf.workspace_id
          WHERE ab.workspace_id = ${workspaceId}
          ORDER BY ab.created_at DESC
          LIMIT ${limit}
        `;

    return NextResponse.json({
      responses: (rows || []).map((row: any) => ({
        ...row,
        details:
          typeof row.details === 'string'
            ? JSON.parse(row.details || '{}')
            : (row.details || {}),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load flow responses' },
      { status: 500 }
    );
  }
}

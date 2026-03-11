import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
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
    const workspaceId = searchParams.get('workspaceId');

    const workflowsRaw = workspaceId
      ? await sql`
          SELECT w.* FROM workflows w
          INNER JOIN workspaces ws ON w.workspace_id = ws.id
          WHERE ws.owner_id = ${userId} AND w.workspace_id = ${workspaceId}
          ORDER BY w.created_at DESC
        `
      : await sql`
          SELECT w.* FROM workflows w
          INNER JOIN workspaces ws ON w.workspace_id = ws.id
          WHERE ws.owner_id = ${userId}
          ORDER BY w.created_at DESC
        `;

    const workflows = workflowsRaw.map((w: any) => ({
      ...w,
      nodes: typeof w.nodes === 'string' ? JSON.parse(w.nodes || '[]') : (w.nodes || []),
      edges: typeof w.edges === 'string' ? JSON.parse(w.edges || '[]') : (w.edges || []),
    }));

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Workflows list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

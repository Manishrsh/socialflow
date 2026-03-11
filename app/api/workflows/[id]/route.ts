import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
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

    const workflows = await sql`
      SELECT w.* FROM workflows w
      INNER JOIN workspaces ws ON w.workspace_id = ws.id
      WHERE w.id = ${id} AND ws.owner_id = ${userId}
      LIMIT 1
    `;

    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflow = workflows[0];
    return NextResponse.json({
      ...workflow,
      nodes:
        typeof workflow.nodes === 'string'
          ? JSON.parse(workflow.nodes || '[]')
          : (workflow.nodes || []),
      edges:
        typeof workflow.edges === 'string'
          ? JSON.parse(workflow.edges || '[]')
          : (workflow.edges || []),
    });
  } catch (error) {
    console.error('Workflow fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { name, description, nodes, edges, isActive } = await request.json();

    await sql`
      UPDATE workflows
      SET
        name = COALESCE(${name || null}, name),
        description = COALESCE(${description || null}, description),
        nodes = COALESCE(${nodes ? JSON.stringify(nodes) : null}, nodes),
        edges = COALESCE(${edges ? JSON.stringify(edges) : null}, edges),
        is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = ${userId}
        )
    `;

    return NextResponse.json({ message: 'Workflow updated successfully' });
  } catch (error) {
    console.error('Workflow update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await sql`
      DELETE FROM workflows
      WHERE id = ${id}
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = ${userId}
        )
    `;

    return NextResponse.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Workflow delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

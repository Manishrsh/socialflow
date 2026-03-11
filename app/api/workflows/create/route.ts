import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { name, description, workspaceId, nodes, edges } = await request.json();

    if (!name || !workspaceId) {
      return NextResponse.json(
        { error: 'Name and workspace ID are required' },
        { status: 400 }
      );
    }

    const workflowId = uuidv4();

    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { error: 'Invalid workspace. Please re-login and try again.' },
        { status: 400 }
      );
    }

    // Create workflow
    await sql`
      INSERT INTO workflows (id, workspace_id, name, description, nodes, edges, is_active)
      VALUES (
        ${workflowId},
        ${workspaceId},
        ${name},
        ${description || null},
        ${JSON.stringify(nodes || [])},
        ${JSON.stringify(edges || [])},
        ${false}
      )
    `;

    return NextResponse.json(
      { workflowId, message: 'Workflow created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Workflow creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

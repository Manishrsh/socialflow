import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
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
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM customers c
      INNER JOIN workspaces ws ON c.workspace_id = ws.id
      WHERE ws.owner_id = $1
    `;
    const params: any[] = [userId];

    if (workspaceId) {
      baseQuery += ` AND c.workspace_id = $${params.length + 1}`;
      params.push(workspaceId);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      baseQuery += ` AND (c.name ILIKE $${params.length + 1} OR c.phone ILIKE $${params.length + 1} OR c.email ILIKE $${params.length + 1})`;
      params.push(searchTerm);
    }

    if (tag) {
      baseQuery += ` AND $${params.length + 1} = ANY(c.tags)`;
      params.push(tag);
    }

    const countResult = await sql.unsafe(
      `SELECT COUNT(*)::int AS count ${baseQuery}`,
      params
    );

    const customers = await sql.unsafe(
      `SELECT c.* ${baseQuery} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      customers,
      total: countResult[0]?.count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Customers list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

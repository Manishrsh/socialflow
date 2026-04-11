import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';

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
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const limit = Math.min(100, Number(searchParams.get('limit') || 50));
    const offset = Number(searchParams.get('offset') || 0);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;

    if (!workspace || workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Build query with filters
    let query = sql`
      SELECT 
        sm.id,
        sm.customer_id,
        sm.phone,
        sm.message,
        sm.scheduled_at,
        sm.status,
        sm.error_message,
        sm.created_at,
        sm.updated_at,
        c.name as customer_name
      FROM scheduled_messages sm
      LEFT JOIN customers c ON sm.customer_id = c.id
      WHERE sm.workspace_id = ${workspaceId}
    `;

    if (status) {
      query = sql`${query} AND sm.status = ${status}`;
    }

    if (customerId) {
      query = sql`${query} AND sm.customer_id = ${customerId}`;
    }

    query = sql`${query} ORDER BY sm.scheduled_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const messages = await query;

    // Get total count
    let countQuery = sql`SELECT COUNT(*) as count FROM scheduled_messages WHERE workspace_id = ${workspaceId}`;
    if (status) {
      countQuery = sql`${countQuery} AND status = ${status}`;
    }
    if (customerId) {
      countQuery = sql`${countQuery} AND customer_id = ${customerId}`;
    }

    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      messages: messages.map((m: any) => ({
        id: m.id,
        customerId: m.customer_id,
        customerName: m.customer_name,
        phone: m.phone,
        message: m.message,
        scheduledAt: m.scheduled_at,
        status: m.status,
        errorMessage: m.error_message,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[v0] List scheduled messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

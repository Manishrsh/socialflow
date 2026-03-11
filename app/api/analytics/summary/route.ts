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
    const period = searchParams.get('period') || '30'; // days

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    let whereClause = 'ws.user_id = $1';
    const params: any[] = [userId];

    if (workspaceId) {
      whereClause += ` AND w.workspace_id = $${params.length + 1}`;
      params.push(workspaceId);
    }

    // Total customers
    const customersResult = await query(
      `SELECT COUNT(*) as count FROM customers c
       INNER JOIN workspaces w ON c.workspace_id = w.id
       INNER JOIN users ws ON w.user_id = ws.id
       WHERE ${whereClause}`,
      params
    );

    // Total messages
    const messagesResult = await query(
      `SELECT COUNT(*) as count FROM messages m
       INNER JOIN customers c ON m.customer_id = c.id
       INNER JOIN workspaces w ON c.workspace_id = w.id
       INNER JOIN users ws ON w.user_id = ws.id
       WHERE ${whereClause} AND m.created_at >= $${params.length + 1}`,
      [...params, startDate]
    );

    // Active workflows
    const workflowsResult = await query(
      `SELECT COUNT(*) as count FROM workflows w
       INNER JOIN workspaces ws_table ON w.workspace_id = ws_table.id
       INNER JOIN users u ON ws_table.user_id = u.id
       WHERE u.id = $1 AND w.is_active = true`,
      [userId]
    );

    // Engagement rate (messages with replies in last period)
    const engagementResult = await query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN direction = 'incoming' THEN customer_id END) as engaged_customers,
        COUNT(*) as total_messages
       FROM messages m
       INNER JOIN customers c ON m.customer_id = c.id
       INNER JOIN workspaces w ON c.workspace_id = w.id
       INNER JOIN users ws ON w.user_id = ws.id
       WHERE ${whereClause} AND m.created_at >= $${params.length + 1}`,
      [...params, startDate]
    );

    // Messages by type
    const messageTypeResult = await query(
      `SELECT message_type, COUNT(*) as count FROM messages m
       INNER JOIN customers c ON m.customer_id = c.id
       INNER JOIN workspaces w ON c.workspace_id = w.id
       INNER JOIN users ws ON w.user_id = ws.id
       WHERE ${whereClause} AND m.created_at >= $${params.length + 1}
       GROUP BY message_type`,
      [...params, startDate]
    );

    // Daily message trend
    const trendResult = await query(
      `SELECT 
        DATE(m.created_at) as date,
        COUNT(*) as count
       FROM messages m
       INNER JOIN customers c ON m.customer_id = c.id
       INNER JOIN workspaces w ON c.workspace_id = w.id
       INNER JOIN users ws ON w.user_id = ws.id
       WHERE ${whereClause} AND m.created_at >= $${params.length + 1}
       GROUP BY DATE(m.created_at)
       ORDER BY date DESC`,
      [...params, startDate]
    );

    const totalMessages = parseInt(messagesResult.rows[0]?.count || 0);
    const engagedCustomers = parseInt(engagementResult.rows[0]?.engaged_customers || 0);
    const engagementRate = totalMessages > 0 ? Math.round((engagedCustomers / parseInt(customersResult.rows[0]?.count || 1)) * 100) : 0;

    return NextResponse.json({
      summary: {
        totalCustomers: parseInt(customersResult.rows[0]?.count || 0),
        totalMessages,
        activeWorkflows: parseInt(workflowsResult.rows[0]?.count || 0),
        engagementRate,
        period: periodDays,
      },
      messageTypes: messageTypeResult.rows.map((r: any) => ({
        type: r.message_type,
        count: parseInt(r.count),
      })),
      trend: trendResult.rows.map((r: any) => ({
        date: r.date,
        count: parseInt(r.count),
      })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

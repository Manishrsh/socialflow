import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getStaffPerformance } from '@/lib/analytics-service';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const dateStr = request.nextUrl.searchParams.get('date');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    // Verify workspace access
    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId}
    `;

    if (workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get staff performance
    const date = dateStr ? new Date(dateStr) : undefined;
    const staffMetrics = await getStaffPerformance(workspaceId, date);

    // Get staff member details
    const staffDetails = await sql`
      SELECT u.id, u.name, u.email
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ${workspaceId}
    `;

    const staffMap = new Map(staffDetails.map((s: any) => [s.id, { name: s.name, email: s.email }]));

    // Enhance metrics with staff details
    const enhancedMetrics = staffMetrics.map((metric: any) => {
      const staffInfo = staffMap.get(metric.staff_id);
      return {
        staff_id: metric.staff_id,
        staff_name: staffInfo?.name || 'Unknown',
        staff_email: staffInfo?.email || '',
        chats_handled: metric.chats_handled || 0,
        messages_sent: metric.messages_sent || 0,
        avg_response_time_seconds: metric.avg_response_time_seconds || 0,
        first_response_time_seconds: metric.first_response_time_seconds || 0,
        conversion_rate: metric.conversion_rate || 0,
        customer_satisfaction: metric.customer_satisfaction || 0,
      };
    });

    // Calculate aggregate metrics
    const totalChats = enhancedMetrics.reduce((sum, m) => sum + m.chats_handled, 0);
    const avgResponseTime =
      enhancedMetrics.length > 0
        ? Math.round(
            enhancedMetrics.reduce((sum, m) => sum + m.avg_response_time_seconds, 0) / enhancedMetrics.length
          )
        : 0;

    return NextResponse.json({
      staff_metrics: enhancedMetrics.sort((a, b) => b.chats_handled - a.chats_handled),
      summary: {
        total_staff: enhancedMetrics.length,
        total_chats_handled: totalChats,
        avg_response_time_seconds: avgResponseTime,
        top_performer: enhancedMetrics.length > 0 ? enhancedMetrics[0] : null,
        lowest_response_time: enhancedMetrics.length > 0 ? enhancedMetrics.sort((a, b) => a.avg_response_time_seconds - b.avg_response_time_seconds)[0] : null,
      },
      performance_rankings: {
        by_chats_handled: enhancedMetrics.slice(0, 5),
        by_conversion_rate: enhancedMetrics.sort((a, b) => b.conversion_rate - a.conversion_rate).slice(0, 5),
        by_response_time: enhancedMetrics.sort((a, b) => a.avg_response_time_seconds - b.avg_response_time_seconds).slice(0, 5),
      },
      metadata: {
        date: dateStr || new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Staff performance endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

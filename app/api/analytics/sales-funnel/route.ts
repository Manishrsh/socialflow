import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getSalesFunnel } from '@/lib/analytics-service';

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
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

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

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get funnel data
    const { funnel, conversions } = await getSalesFunnel(workspaceId, start, end);

    // Get funnel breakdown by time periods (weekly)
    const weeklyBreakdown = await sql`
      SELECT
        DATE_TRUNC('week', triggered_at) as week,
        stage,
        COUNT(DISTINCT customer_id) as count
      FROM sales_funnel_events
      WHERE workspace_id = ${workspaceId}
        AND triggered_at >= ${start.toISOString()}
        AND triggered_at <= ${end.toISOString()}
      GROUP BY DATE_TRUNC('week', triggered_at), stage
      ORDER BY week DESC
    `;

    const weeklyData: { [key: string]: any } = {};
    weeklyBreakdown.forEach((row: any) => {
      const week = row.week.toISOString().split('T')[0];
      if (!weeklyData[week]) {
        weeklyData[week] = {
          week,
          inquiry: 0,
          discussion: 0,
          purchase: 0,
          completion: 0,
        };
      }
      if (row.stage in weeklyData[week]) {
        weeklyData[week][row.stage] = row.count;
      }
    });

    return NextResponse.json({
      funnel: {
        inquiry: funnel.inquiry,
        discussion: funnel.discussion,
        purchase: funnel.purchase,
        completion: funnel.completion,
      },
      conversions: {
        inquiry_to_discussion: Math.round(conversions.inquiry_to_discussion * 100) / 100,
        discussion_to_purchase: Math.round(conversions.discussion_to_purchase * 100) / 100,
        purchase_to_completion: Math.round(conversions.purchase_to_completion * 100) / 100,
        overall: Math.round(conversions.overall * 100) / 100,
      },
      weeklyBreakdown: Object.values(weeklyData),
      metadata: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Sales funnel endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

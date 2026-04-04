import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId}
    `;

    if (workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get response time metrics
    const responseMetrics = await sql`
      SELECT
        AVG(response_time_seconds) as avg_time,
        MIN(response_time_seconds) as min_time,
        MAX(response_time_seconds) as max_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_seconds) as median_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_seconds) as p95_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_seconds) as p99_time,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN response_time_seconds IS NULL THEN 1 END) as no_response_count,
        COUNT(CASE WHEN response_time_seconds < 60 THEN 1 END) as under_1min,
        COUNT(CASE WHEN response_time_seconds >= 60 AND response_time_seconds < 300 THEN 1 END) as 1_to_5min,
        COUNT(CASE WHEN response_time_seconds >= 300 AND response_time_seconds < 3600 THEN 1 END) as 5min_to_1hour,
        COUNT(CASE WHEN response_time_seconds >= 3600 THEN 1 END) as over_1hour
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sent_at >= ${startDate.toISOString()}
    `;

    // Get hourly breakdown
    const hourlyBreakdown = await sql`
      SELECT
        EXTRACT(HOUR FROM sent_at) as hour,
        AVG(response_time_seconds) as avg_time,
        COUNT(*) as message_count
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sent_at >= ${startDate.toISOString()}
      GROUP BY EXTRACT(HOUR FROM sent_at)
      ORDER BY hour
    `;

    // Get daily breakdown
    const dailyBreakdown = await sql`
      SELECT
        DATE(sent_at) as day,
        AVG(response_time_seconds) as avg_time,
        COUNT(*) as message_count
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sent_at >= ${startDate.toISOString()}
      GROUP BY DATE(sent_at)
      ORDER BY day DESC
    `;

    // Get SLA compliance (assuming 5 minute SLA)
    const slaBreach = responseMetrics[0];
    const slaTarget = 300; // 5 minutes
    const slaBreachers = slaBreach.total_messages - (slaBreach.under_1min + slaBreach['1_to_5min']);
    const slaComplianceRate = Math.round(((slaBreach.total_messages - slaBreachers) / slaBreach.total_messages) * 100);

    return NextResponse.json({
      summary: {
        avg_response_time: Math.round(slaBreach.avg_time || 0),
        median_response_time: Math.round(slaBreach.median_time || 0),
        min_response_time: Math.round(slaBreach.min_time || 0),
        max_response_time: Math.round(slaBreach.max_time || 0),
        p95_response_time: Math.round(slaBreach.p95_time || 0),
        p99_response_time: Math.round(slaBreach.p99_time || 0),
        total_messages: slaBreach.total_messages,
        unanswered_messages: slaBreach.no_response_count,
        sla_compliance_rate: slaComplianceRate,
      },
      distribution: {
        under_1min: slaBreach.under_1min,
        '1_to_5min': slaBreach['1_to_5min'],
        '5min_to_1hour': slaBreach['5min_to_1hour'],
        'over_1hour': slaBreach.over_1hour,
      },
      percentage_distribution: {
        under_1min: Math.round((slaBreach.under_1min / slaBreach.total_messages) * 100),
        '1_to_5min': Math.round((slaBreach['1_to_5min'] / slaBreach.total_messages) * 100),
        '5min_to_1hour': Math.round((slaBreach['5min_to_1hour'] / slaBreach.total_messages) * 100),
        'over_1hour': Math.round((slaBreach.over_1hour / slaBreach.total_messages) * 100),
      },
      hourly_breakdown: hourlyBreakdown.map((h: any) => ({
        hour: h.hour,
        avg_time: Math.round(h.avg_time || 0),
        message_count: h.message_count,
      })),
      daily_breakdown: dailyBreakdown.map((d: any) => ({
        day: d.day,
        avg_time: Math.round(d.avg_time || 0),
        message_count: d.message_count,
      })),
      sla_metrics: {
        target_seconds: slaTarget,
        compliance_rate: slaComplianceRate,
        breaches: slaBreachers,
        recommendation: slaComplianceRate < 80 ? 'Hire more support staff or automate responses' : 'SLA targets being met',
      },
      metadata: {
        days: days,
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Response metrics endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

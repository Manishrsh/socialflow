import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getLostLeads, getSentimentDistribution } from '@/lib/analytics-service';

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

    const alerts: any[] = [];

    // Check for high lost leads
    const lostLeads = await getLostLeads(workspaceId, 7);
    if (lostLeads.length > 5) {
      alerts.push({
        type: 'high_lost_leads',
        severity: 'high',
        message: `⚠️ ${lostLeads.length} leads have gone inactive in the last 7 days. Estimated revenue loss: $${Math.round(
          lostLeads.reduce((sum, lead) => sum + (lead.intent_score || 0) * 50000, 0)
        )}`,
        timestamp: new Date().toISOString(),
        action_url: '/dashboard/analytics?filter=lost_leads',
      });
    }

    // Check for negative sentiment spike
    const sentiment = await getSentimentDistribution(workspaceId, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const totalMessages = sentiment.positive + sentiment.neutral + sentiment.negative;
    const negativeRatio = totalMessages > 0 ? sentiment.negative / totalMessages : 0;

    if (negativeRatio > 0.3) {
      alerts.push({
        type: 'negative_sentiment',
        severity: 'medium',
        message: `📉 Negative sentiment is ${Math.round(negativeRatio * 100)}% in last 24h. ${sentiment.negative} negative messages detected.`,
        timestamp: new Date().toISOString(),
        action_url: '/dashboard/analytics?filter=sentiment',
      });
    }

    // Check for slow response times
    const responseMetrics = await sql`
      SELECT
        AVG(response_time_seconds) as avg_time,
        COUNT(CASE WHEN response_time_seconds > 600 THEN 1 END) as slow_responses
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sent_at >= NOW() - INTERVAL '1 day'
        AND response_time_seconds IS NOT NULL
    `;

    if (responseMetrics.length > 0) {
      const metric = responseMetrics[0];
      if ((metric.avg_time || 0) > 300) {
        // 5 minutes
        alerts.push({
          type: 'slow_response_time',
          severity: 'medium',
          message: `⏱️ Average response time is ${Math.round(metric.avg_time / 60)} minutes. ${metric.slow_responses} messages took >10 min to respond.`,
          timestamp: new Date().toISOString(),
          action_url: '/dashboard/analytics?filter=response_time',
        });
      }
    }

    // Check for high product demand
    const topProducts = await sql`
      SELECT
        product_name,
        mention_count,
        trend
      FROM product_demand
      WHERE workspace_id = ${workspaceId}
      ORDER BY mention_count DESC
      LIMIT 3
    `;

    const highDemandProducts = topProducts.filter((p: any) => p.mention_count >= 10);
    if (highDemandProducts.length > 0) {
      alerts.push({
        type: 'high_product_demand',
        severity: 'low',
        message: `📈 High demand detected for: ${highDemandProducts.map((p: any) => p.product_name).join(', ')}. ${highDemandProducts[0].mention_count} mentions.`,
        timestamp: new Date().toISOString(),
        action_url: '/dashboard/analytics?filter=product_demand',
      });
    }

    // Check for no recent activity
    const recentActivity = await sql`
      SELECT COUNT(*) as count
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sent_at >= NOW() - INTERVAL '24 hours'
    `;

    if (recentActivity.length > 0 && recentActivity[0].count === 0) {
      alerts.push({
        type: 'no_recent_activity',
        severity: 'low',
        message: `🔇 No message activity in the last 24 hours.`,
        timestamp: new Date().toISOString(),
        action_url: '/dashboard/messages',
      });
    }

    // Check for new hot leads
    const newHotLeads = await sql`
      SELECT COUNT(*) as count
      FROM customers
      WHERE workspace_id = ${workspaceId}
        AND customer_segment = 'hot'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `;

    if (newHotLeads.length > 0 && newHotLeads[0].count > 0) {
      alerts.push({
        type: 'new_hot_leads',
        severity: 'low',
        message: `🔥 ${newHotLeads[0].count} new hot leads identified in the last 24 hours!`,
        timestamp: new Date().toISOString(),
        action_url: '/dashboard/analytics?filter=hot_leads',
      });
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);

    return NextResponse.json({
      alerts,
      summary: {
        total_alerts: alerts.length,
        high_severity: alerts.filter(a => a.severity === 'high').length,
        medium_severity: alerts.filter(a => a.severity === 'medium').length,
        low_severity: alerts.filter(a => a.severity === 'low').length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Alerts endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

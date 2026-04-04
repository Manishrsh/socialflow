import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getSentimentDistribution } from '@/lib/analytics-service';

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

    // Parse dates if provided
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Get sentiment distribution
    const distribution = await getSentimentDistribution(workspaceId, start, end);

    // Get sentiment trends (last 7 days)
    const trends = await sql`
      SELECT
        DATE(sent_at) as date,
        sentiment,
        COUNT(*) as count,
        AVG(sentiment_score) as avg_score
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND sentiment IS NOT NULL
        AND sent_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(sent_at), sentiment
      ORDER BY DATE(sent_at) DESC
    `;

    const trendsByDate: { [key: string]: any } = {};
    trends.forEach((trend: any) => {
      const date = trend.date.toISOString().split('T')[0];
      if (!trendsByDate[date]) {
        trendsByDate[date] = {
          date,
          positive: 0,
          neutral: 0,
          negative: 0,
          avgScore: 0,
        };
      }
      if (trend.sentiment === 'positive') trendsByDate[date].positive = trend.count;
      if (trend.sentiment === 'neutral') trendsByDate[date].neutral = trend.count;
      if (trend.sentiment === 'negative') trendsByDate[date].negative = trend.count;
    });

    return NextResponse.json({
      overall: distribution.average,
      breakdown: {
        positive: distribution.positive,
        neutral: distribution.neutral,
        negative: distribution.negative,
      },
      percentages: {
        positive: ((distribution.positive / (distribution.positive + distribution.neutral + distribution.negative)) * 100) || 0,
        neutral: ((distribution.neutral / (distribution.positive + distribution.neutral + distribution.negative)) * 100) || 0,
        negative: ((distribution.negative / (distribution.positive + distribution.neutral + distribution.negative)) * 100) || 0,
      },
      trend: Object.values(trendsByDate),
      metadata: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Sentiment endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

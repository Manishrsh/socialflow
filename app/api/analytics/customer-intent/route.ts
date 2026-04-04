import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getIntentDistribution } from '@/lib/analytics-service';

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

    // Get intent distribution
    const intents = await getIntentDistribution(workspaceId);

    // Get customer segments
    const segments = await sql`
      SELECT
        customer_segment,
        COUNT(*) as count
      FROM customers
      WHERE workspace_id = ${workspaceId}
      GROUP BY customer_segment
    `;

    const segmentCounts = {
      new: 0,
      returning: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      ghost: 0,
    };

    segments.forEach((seg: any) => {
      if (seg.customer_segment in segmentCounts) {
        segmentCounts[seg.customer_segment as keyof typeof segmentCounts] = seg.count;
      }
    });

    // Get hot leads details
    const hotLeads = await sql`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.intent_score,
        COUNT(m.id) as message_count,
        MAX(m.sent_at) as last_message_at
      FROM customers c
      LEFT JOIN messages m ON c.id = m.customer_id
      WHERE c.workspace_id = ${workspaceId}
        AND c.customer_segment = 'hot'
      GROUP BY c.id, c.name, c.phone, c.intent_score
      ORDER BY c.intent_score DESC
      LIMIT 10
    `;

    // Calculate conversion likelihood
    const intentsWithLikelihood = Object.entries(intents).map(([intentType, data]: any) => ({
      intent: intentType,
      count: data.count,
      conversion_rate: data.conversion_rate,
      conversion_likelihood: intentType === 'buying' ? 'high' : intentType === 'inquiry' ? 'medium' : 'low',
    }));

    return NextResponse.json({
      intents: intentsWithLikelihood,
      segments: segmentCounts,
      segment_summary: {
        total_customers: Object.values(segmentCounts).reduce((a, b) => a + b, 0),
        hot_leads_count: segmentCounts.hot,
        warm_leads_count: segmentCounts.warm,
        cold_leads_count: segmentCounts.cold,
        ghost_customers_count: segmentCounts.ghost,
        hot_to_total_ratio: (segmentCounts.hot / Object.values(segmentCounts).reduce((a, b) => a + b, 1)) * 100,
      },
      hot_leads: hotLeads.map((lead: any) => ({
        id: lead.id,
        name: lead.name || 'Unknown',
        phone: lead.phone,
        intent_score: lead.intent_score,
        message_count: lead.message_count,
        last_contact: lead.last_message_at,
      })),
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Customer intent endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

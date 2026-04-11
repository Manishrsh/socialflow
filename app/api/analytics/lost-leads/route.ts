import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getLostLeads } from '@/lib/analytics-service';

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
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');

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

    // Get lost leads
    const leads = await getLostLeads(workspaceId, days);

    // Estimate lost revenue (based on intent score and average deal value)
    const leadsWithEstimate = leads.map((lead: any) => ({
      id: lead.id,
      phone: lead.phone,
      name: lead.name || 'Unknown',
      segment: lead.customer_segment || 'unknown',
      intentscore: lead.intent_score || 0,
      message_count: lead.message_count || 0,
      last_message_at: lead.last_message_at,
      days_inactive: Math.floor(lead.days_inactive || 0),
      estimated_revenue_loss: Math.round((lead.intent_score || 0) * 50000), // Assume ~50k per high intent lead
    }));

    // Calculate summary
    const totalRevenueLoss = leadsWithEstimate.reduce((sum, lead) => sum + lead.estimated_revenue_loss, 0);

    return NextResponse.json({
      lost_leads: leadsWithEstimate,
      summary: {
        total_lost_leads: leadsWithEstimate.length,
        total_estimated_revenue_loss: totalRevenueLoss,
        avg_days_inactive: Math.round(
          leadsWithEstimate.reduce((sum, lead) => sum + lead.days_inactive, 0) / leadsWithEstimate.length
        ) || 0,
        high_value_lost_leads: leadsWithEstimate.filter(l => l.intentscore > 0.7).length,
      },
      recovery_opportunities: leadsWithEstimate
        .filter(l => l.intentscore > 0.5)
        .sort((a, b) => b.estimated_revenue_loss - a.estimated_revenue_loss)
        .slice(0, 10),
      metadata: {
        inactivity_days: days,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Lost leads endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

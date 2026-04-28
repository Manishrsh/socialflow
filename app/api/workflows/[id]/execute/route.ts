import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(authToken);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get user's primary workspace
    const workspaces = await sql`
      SELECT id FROM workspaces WHERE owner_id = ${userId} LIMIT 1
    `;

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = workspaces[0].id;

    // Total Clicks & Unique Users
    const overview = await sql`
      SELECT 
        COUNT(*) as total_clicks,
        COUNT(DISTINCT customer_phone) as unique_users
      FROM button_interactions
      WHERE workspace_id = ${workspaceId} 
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    // Top Buttons
    const topButtons = await sql`
      SELECT 
        button_title as name, 
        COUNT(*) as value
      FROM button_interactions
      WHERE workspace_id = ${workspaceId} 
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY button_title
      ORDER BY value DESC
      LIMIT 5
    `;

    // Top Engaged Users
    const topUsers = await sql`
      SELECT 
        customer_phone as phone, 
        COUNT(*) as clicks,
        MAX(created_at) as last_active
      FROM button_interactions
      WHERE workspace_id = ${workspaceId} 
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY customer_phone
      ORDER BY clicks DESC
      LIMIT 10
    `;

    // Daily Trends (For Bar Chart)
    const dailyTrends = await sql`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        COUNT(*) as clicks
      FROM button_interactions
      WHERE workspace_id = ${workspaceId} 
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    return NextResponse.json({
      success: true,
      overview: {
        totalClicks: parseInt(overview[0]?.total_clicks || '0'),
        uniqueUsers: parseInt(overview[0]?.unique_users || '0'),
      },
      topButtons: topButtons || [],
      topUsers: topUsers || [],
      dailyTrends: dailyTrends || [],
    });

  } catch (error: any) {
    // If table doesn't exist yet, return empty safe data
    if (error.message?.includes('relation "button_interactions" does not exist')) {
      return NextResponse.json({
        success: true,
        overview: { totalClicks: 0, uniqueUsers: 0 },
        topButtons: [],
        topUsers: [],
        dailyTrends: [],
      });
    }
    console.error('[Button Analytics API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
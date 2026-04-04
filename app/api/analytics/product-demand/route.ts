import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getProductDemand } from '@/lib/analytics-service';

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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

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

    // Get product demand
    const products = await getProductDemand(workspaceId, limit);

    // Calculate conversion rates
    const productsWithRates = products.map(p => ({
      ...p,
      conversion_rate: p.conversions > 0 ? Math.round((p.conversions / p.mentions) * 100) : 0,
      inquiry_rate: p.inquiries > 0 ? Math.round((p.inquiries / p.mentions) * 100) : 0,
      avg_revenue_per_mention: p.mentions > 0 ? Math.round((p.revenue / p.mentions) * 100) / 100 : 0,
    }));

    // Get trending products (top gainers)
    const trendingProducts = await sql`
      SELECT
        product_name,
        mention_count,
        trend
      FROM product_demand
      WHERE workspace_id = ${workspaceId}
        AND trend = 'up'
      ORDER BY mention_count DESC
      LIMIT 5
    `;

    return NextResponse.json({
      products: productsWithRates,
      trending: trendingProducts.map((p: any) => ({
        product: p.product_name,
        mentions: p.mention_count,
        trend: p.trend,
      })),
      summary: {
        total_products_tracked: productsWithRates.length,
        total_mentions: productsWithRates.reduce((sum, p) => sum + p.mentions, 0),
        total_conversions: productsWithRates.reduce((sum, p) => sum + p.conversions, 0),
        total_revenue: productsWithRates.reduce((sum, p) => sum + p.revenue, 0),
        avg_conversion_rate: Math.round(
          productsWithRates.reduce((sum, p) => sum + p.conversion_rate, 0) / productsWithRates.length
        ) || 0,
      },
      metadata: {
        limit,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Product demand endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

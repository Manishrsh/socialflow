import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getTopKeywords } from '@/lib/analytics-service';

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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
    const productType = request.nextUrl.searchParams.get('productType');

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

    // Get top keywords
    const keywords = await getTopKeywords(workspaceId, limit, productType);

    return NextResponse.json({
      keywords: keywords.map((k: any) => ({
        keyword: k.keyword,
        frequency: k.frequency,
        sentiment: k.sentiment,
        lastSeen: k.last_seen,
      })),
      total: keywords.length,
      metadata: {
        limit,
        productType,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Keywords endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

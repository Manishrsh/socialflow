import { NextRequest, NextResponse } from 'next/server';
import { getWpboxTraces } from '@/lib/wpbox-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') || '50');
  const traces = getWpboxTraces(limitParam);

  return NextResponse.json({
    success: true,
    count: traces.length,
    traces,
  });
}

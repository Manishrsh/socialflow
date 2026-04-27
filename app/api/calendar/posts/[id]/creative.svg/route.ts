import { NextRequest } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureCoreSchema();
    const { id } = await params;

    const rows = await sql`
      SELECT creative_svg
      FROM calendar_event_posts
      WHERE id = ${id}
      LIMIT 1
    `;

    const creativeSvg = rows?.[0]?.creative_svg;
    if (!creativeSvg) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(creativeSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error: any) {
    console.error('[Calendar] Creative SVG error:', error);
    return new Response('Failed to load creative', { status: 500 });
  }
}

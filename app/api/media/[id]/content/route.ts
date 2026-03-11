import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureCoreSchema();
    const { id } = await params;

    const rows = await sql`
      SELECT id, name, mime_type, metadata
      FROM media
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const media = rows[0];
    const metadata =
      typeof media.metadata === 'string'
        ? JSON.parse(media.metadata || '{}')
        : (media.metadata || {});

    if (!metadata?.base64) {
      return NextResponse.json(
        { error: 'No inline media content available for this item' },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(metadata.base64, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': media.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${media.name || 'media'}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Media content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

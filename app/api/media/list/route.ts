import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const fileType = String(searchParams.get('fileType') || '').trim().toLowerCase();
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

    const workspaceFilter = workspaceId
      ? await sql`
          SELECT m.*
          FROM media m
          INNER JOIN workspaces ws ON m.workspace_id = ws.id
          WHERE ws.owner_id = ${userId} AND m.workspace_id = ${workspaceId}
          ORDER BY m.created_at DESC
          LIMIT ${Math.max(1, limit)}
          OFFSET ${Math.max(0, offset)}
        `
      : await sql`
          SELECT m.*
          FROM media m
          INNER JOIN workspaces ws ON m.workspace_id = ws.id
          WHERE ws.owner_id = ${userId}
          ORDER BY m.created_at DESC
          LIMIT ${Math.max(1, limit)}
          OFFSET ${Math.max(0, offset)}
        `;

    const typed = fileType
      ? workspaceFilter.filter((row: any) =>
          String(row.mime_type || '')
            .toLowerCase()
            .startsWith(fileType)
        )
      : workspaceFilter;

    const media = typed.map((row: any) => ({
      id: row.id,
      title: row.name || 'Untitled',
      file_name: row.name || 'file',
      file_type: row.mime_type || row.type || 'application/octet-stream',
      file_size: row.size_bytes || 0,
      url: row.url,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      media,
      total: media.length,
      page: Math.max(1, page),
      limit: Math.max(1, limit),
    });
  } catch (error) {
    console.error('Media list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

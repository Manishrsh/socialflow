import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';

function getPublicOrigin(request: NextRequest): string {
  const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
  const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const envBaseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');

  return new URL(request.url).origin;
}

function normalizeMediaUrl(url: string, publicOrigin: string): string {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/')) return `${publicOrigin}${raw}`;
  return raw.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, publicOrigin);
}

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
    const mimePrefix = fileType ? `${fileType}%` : null;

    const rows = workspaceId
      ? mimePrefix
        ? await sql`
            SELECT m.*
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND m.workspace_id = ${workspaceId}
              AND LOWER(COALESCE(m.mime_type, '')) LIKE ${mimePrefix}
            ORDER BY m.created_at DESC
            LIMIT ${Math.max(1, limit)}
            OFFSET ${Math.max(0, offset)}
          `
        : await sql`
            SELECT m.*
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND m.workspace_id = ${workspaceId}
            ORDER BY m.created_at DESC
            LIMIT ${Math.max(1, limit)}
            OFFSET ${Math.max(0, offset)}
          `
      : mimePrefix
        ? await sql`
            SELECT m.*
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND LOWER(COALESCE(m.mime_type, '')) LIKE ${mimePrefix}
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

    const totalRows = workspaceId
      ? mimePrefix
        ? await sql`
            SELECT COUNT(*)::int AS count
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND m.workspace_id = ${workspaceId}
              AND LOWER(COALESCE(m.mime_type, '')) LIKE ${mimePrefix}
          `
        : await sql`
            SELECT COUNT(*)::int AS count
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND m.workspace_id = ${workspaceId}
          `
      : mimePrefix
        ? await sql`
            SELECT COUNT(*)::int AS count
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
              AND LOWER(COALESCE(m.mime_type, '')) LIKE ${mimePrefix}
          `
        : await sql`
            SELECT COUNT(*)::int AS count
            FROM media m
            INNER JOIN workspaces ws ON m.workspace_id = ws.id
            WHERE ws.owner_id = ${userId}
          `;

    const publicOrigin = getPublicOrigin(request);
    const media = rows.map((row: any) => ({
      id: row.id,
      title: row.name || 'Untitled',
      file_name: row.name || 'file',
      file_type: row.mime_type || row.type || 'application/octet-stream',
      file_size: row.size_bytes || 0,
      url: normalizeMediaUrl(String(row.url || ''), publicOrigin),
      created_at: row.created_at,
    }));

    return NextResponse.json({
      media,
      total: Number(totalRows?.[0]?.count || 0),
      page: Math.max(1, page),
      limit: Math.max(1, limit),
    });
  } catch (error) {
    console.error('Media list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

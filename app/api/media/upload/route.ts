import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

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

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = String(formData.get('workspaceId') || '');
    const title = String(formData.get('title') || '').trim();

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: 'File and workspace ID are required' },
        { status: 400 }
      );
    }

    const ws = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
    if (!ws || ws.length === 0) {
      return NextResponse.json({ error: 'Invalid workspace' }, { status: 400 });
    }

    const mediaId = uuidv4();
    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString('base64');
    const mimeType = file.type || 'application/octet-stream';
    const topType = mimeType.split('/')[0] || 'application';
    const origin = getPublicOrigin(request);
    const mediaUrl = `${origin}/api/media/${mediaId}/content`;

    await sql`
      INSERT INTO media (id, workspace_id, type, url, name, size_bytes, mime_type, metadata)
      VALUES (
        ${mediaId},
        ${workspaceId},
        ${topType},
        ${mediaUrl},
        ${title || file.name},
        ${file.size},
        ${mimeType},
        ${JSON.stringify({
          uploadedBy: userId,
          originalFileName: file.name,
          base64,
          encoding: 'base64',
        })}
      )
    `;

    return NextResponse.json(
      {
        mediaId,
        fileName: file.name,
        fileSize: file.size,
        fileType: mimeType,
        url: mediaUrl,
        message: 'Media uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

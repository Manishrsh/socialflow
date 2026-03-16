import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function authUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    return verifySession(token);
}

export async function GET(request: NextRequest) {
    try {
        await ensureCoreSchema();
        const userId = await authUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
        }

        const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
        if (!owned || owned.length === 0) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const templates = await sql`
      SELECT id, name, category, language, status, components, created_at
      FROM whatsapp_templates
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `;

        return NextResponse.json({ success: true, templates: templates || [] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureCoreSchema();
        const userId = await authUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const workspaceId = String(body?.workspaceId || '').trim();
        const name = String(body?.name || '').trim();
        const category = String(body?.category || '').trim();
        const language = String(body?.language || '').trim();
        const components = body?.components || [];

        if (!workspaceId || !name || !category || !language) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
        if (!owned || owned.length === 0) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const result = await sql`
      INSERT INTO whatsapp_templates (workspace_id, name, category, language, components, status)
      VALUES (
        ${workspaceId},
        ${name},
        ${category},
        ${language},
        ${JSON.stringify(components)},
        'APPROVED'
      )
      RETURNING id, name, category, language, status, components, created_at
    `;

        return NextResponse.json({ success: true, template: result[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to create template' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalizeConfig(config: any): Record<string, any> {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config;
  }
  return {};
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const rows = await sql`
      SELECT wf.*
      FROM whatsapp_flows wf
      INNER JOIN workspaces ws ON wf.workspace_id = ws.id
      WHERE wf.id = ${id}
        AND ws.owner_id = ${userId}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'WhatsApp flow not found' }, { status: 404 });
    }

    const flow = rows[0];
    return NextResponse.json({
      ...flow,
      config:
        typeof flow.config === 'string'
          ? JSON.parse(flow.config || '{}')
          : (flow.config || {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load WhatsApp flow' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();

    await sql`
      UPDATE whatsapp_flows
      SET
        name = COALESCE(${String(body?.name || '').trim() || null}, name),
        description = COALESCE(${String(body?.description || '').trim() || null}, description),
        flow_type = COALESCE(${String(body?.flowType || '').trim() || null}, flow_type),
        cta_label = COALESCE(${String(body?.ctaLabel || '').trim() || null}, cta_label),
        meta_flow_id = COALESCE(${String(body?.metaFlowId || '').trim() || null}, meta_flow_id),
        is_active = COALESCE(${body?.isActive === undefined ? null : Boolean(body.isActive)}, is_active),
        config = COALESCE(${body?.config ? JSON.stringify(normalizeConfig(body.config)) : null}, config),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = ${userId}
        )
    `;

    return NextResponse.json({ message: 'WhatsApp flow updated successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update WhatsApp flow' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    await sql`
      DELETE FROM whatsapp_flows
      WHERE id = ${id}
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = ${userId}
        )
    `;

    return NextResponse.json({ message: 'WhatsApp flow deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete WhatsApp flow' },
      { status: 500 }
    );
  }
}

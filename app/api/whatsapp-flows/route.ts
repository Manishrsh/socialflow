import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { createMetaWhatsAppFlow } from '@/lib/meta-flows';

function normalizeConfig(config: any): Record<string, any> {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config;
  }
  return {};
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
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT wf.*
      FROM whatsapp_flows wf
      INNER JOIN workspaces ws ON wf.workspace_id = ws.id
      WHERE wf.workspace_id = ${workspaceId}
        AND ws.owner_id = ${userId}
      ORDER BY wf.updated_at DESC, wf.created_at DESC
    `;

    return NextResponse.json({
      flows: (rows || []).map((row: any) => ({
        ...row,
        config:
          typeof row.config === 'string'
            ? JSON.parse(row.config || '{}')
            : (row.config || {}),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load WhatsApp flows' },
      { status: 500 }
    );
  }
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

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    const flowType = String(body?.flowType || 'appointment').trim().toLowerCase();
    const ctaLabel = String(body?.ctaLabel || 'Book Now').trim();
    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);
    const config = normalizeConfig(body?.config);

    if (!workspaceId || !name) {
      return NextResponse.json({ error: 'workspaceId and name are required' }, { status: 400 });
    }

    const workspace = await sql`
      SELECT id
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;
    if (!workspace || workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const metaFlow = await createMetaWhatsAppFlow({
      workspaceId,
      name,
      flowType,
    });

    const storedConfig = {
      ...config,
      metaSync: {
        status: 'draft_created',
        syncedAt: new Date().toISOString(),
        message: 'Draft Flow created in Meta automatically.',
      },
    };

    const flowId = uuidv4();
    await sql`
      INSERT INTO whatsapp_flows (
        id,
        workspace_id,
        name,
        description,
        flow_type,
        cta_label,
        meta_flow_id,
        is_active,
        config
      )
      VALUES (
        ${flowId},
        ${workspaceId},
        ${name},
        ${description || null},
        ${flowType || 'appointment'},
        ${ctaLabel || 'Book Now'},
        ${metaFlow.id},
        ${isActive},
        ${JSON.stringify(storedConfig)}
      )
    `;

    return NextResponse.json(
      {
        flowId,
        metaFlowId: metaFlow.id,
        message: 'WhatsApp flow created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create WhatsApp flow' },
      { status: 500 }
    );
  }
}

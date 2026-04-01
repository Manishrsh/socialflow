import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import {
  buildMetaFlowJson,
  createMetaWhatsAppFlow,
  updateMetaWhatsAppFlowMetadata,
  uploadMetaWhatsAppFlowJson,
} from '@/lib/meta-flows';

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
    const rows = await sql`
      SELECT wf.*, ws.owner_id
      FROM whatsapp_flows wf
      INNER JOIN workspaces ws ON wf.workspace_id = ws.id
      WHERE wf.id = ${id}
        AND ws.owner_id = ${userId}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'WhatsApp flow not found' }, { status: 404 });
    }

    const existing = rows[0];
    const workspaceId = String(existing.workspace_id);
    const name = String(body?.name || '').trim() || String(existing.name || '').trim();
    const flowType = String(body?.flowType || '').trim() || String(existing.flow_type || '').trim();
    const incomingMetaFlowId = String(body?.metaFlowId || '').trim();
    let resolvedMetaFlowId = incomingMetaFlowId || String(existing.meta_flow_id || '').trim();
    const existingConfig =
      typeof existing.config === 'string'
        ? JSON.parse(existing.config || '{}')
        : normalizeConfig(existing.config);

    if (!resolvedMetaFlowId) {
      const metaFlow = await createMetaWhatsAppFlow({
        workspaceId,
        name,
        flowType,
      });
      resolvedMetaFlowId = metaFlow.id;
    } else {
      await updateMetaWhatsAppFlowMetadata({
        workspaceId,
        flowId: resolvedMetaFlowId,
        name,
        flowType,
      });
    }

    const mergedConfig = body?.config
      ? { ...existingConfig, ...normalizeConfig(body.config) }
      : existingConfig;
    const metaFlowJson = buildMetaFlowJson({
      name,
      ctaLabel: String(body?.ctaLabel || '').trim() || String(existing.cta_label || '').trim(),
      config: mergedConfig,
    });

    await uploadMetaWhatsAppFlowJson({
      workspaceId,
      flowId: resolvedMetaFlowId,
      flowJson: metaFlowJson,
    });

    mergedConfig.metaFlowJson = metaFlowJson;
    mergedConfig.metaSync = {
      status: 'flow_json_uploaded',
      syncedAt: new Date().toISOString(),
      message: 'Flow metadata and flow JSON synced with Meta.',
    };

    await sql`
      UPDATE whatsapp_flows
      SET
        name = COALESCE(${String(body?.name || '').trim() || null}, name),
        description = COALESCE(${String(body?.description || '').trim() || null}, description),
        flow_type = COALESCE(${String(body?.flowType || '').trim() || null}, flow_type),
        cta_label = COALESCE(${String(body?.ctaLabel || '').trim() || null}, cta_label),
        meta_flow_id = ${resolvedMetaFlowId || null},
        is_active = COALESCE(${body?.isActive === undefined ? null : Boolean(body.isActive)}, is_active),
        config = ${JSON.stringify(mergedConfig)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = ${userId}
        )
    `;

    return NextResponse.json({
      message: 'WhatsApp flow updated successfully',
      metaFlowId: resolvedMetaFlowId,
    });
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

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { publishMetaWhatsAppFlow } from '@/lib/meta-flows';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const workspaceId = String(flow.workspace_id || '');
    const metaFlowId = String(flow.meta_flow_id || '').trim();

    if (!workspaceId || !metaFlowId) {
      return NextResponse.json({ error: 'Meta Flow ID is missing for this flow.' }, { status: 400 });
    }

    await publishMetaWhatsAppFlow({
      workspaceId,
      flowId: metaFlowId,
    });

    const existingConfig =
      typeof flow.config === 'string'
        ? JSON.parse(flow.config || '{}')
        : (flow.config || {});
    existingConfig.metaSync = {
      status: 'published',
      syncedAt: new Date().toISOString(),
      message: 'Flow published in Meta successfully.',
    };

    await sql`
      UPDATE whatsapp_flows
      SET
        config = ${JSON.stringify(existingConfig)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Flow published successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to publish WhatsApp flow' },
      { status: 500 }
    );
  }
}

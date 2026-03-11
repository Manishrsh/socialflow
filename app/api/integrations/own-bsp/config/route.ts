import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { getOwnBspRuntimeInfo } from '@/lib/own-bsp-service';

function parseSettings(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

async function requireUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

async function verifyOwner(workspaceId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const isOwner = await verifyOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const runtime = await getOwnBspRuntimeInfo(workspaceId);
    return NextResponse.json({ success: true, config: runtime });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const isOwner = await verifyOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const executionMode = String(body?.executionMode || 'simulate').toLowerCase();
    const autoProcess = !!body?.autoProcess;
    const providerSendUrl = String(body?.providerSendUrl || '').trim();
    const providerTimeoutMs = Math.max(1000, Number(body?.providerTimeoutMs || 15000));

    if (!['simulate', 'manual', 'provider', 'meta'].includes(executionMode)) {
      return NextResponse.json({ error: 'Invalid executionMode' }, { status: 400 });
    }
    if (executionMode === 'provider' && !providerSendUrl) {
      return NextResponse.json(
        { error: 'providerSendUrl is required for provider mode' },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT settings
      FROM workspaces
      WHERE id = ${workspaceId}
      LIMIT 1
    `;
    const settings = parseSettings(rows?.[0]?.settings);
    const nextSettings = {
      ...settings,
      ownBsp: {
        executionMode,
        autoProcess,
        providerSendUrl,
        providerTimeoutMs,
      },
    };

    await sql`
      UPDATE workspaces
      SET settings = ${JSON.stringify(nextSettings)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${workspaceId}
    `;

    const runtime = await getOwnBspRuntimeInfo(workspaceId);
    return NextResponse.json({ success: true, config: runtime });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save config' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function requireUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

async function verifyWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  const owned = await sql`
    SELECT id
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;
  return Array.isArray(owned) && owned.length > 0;
}

function isSet(value?: string): boolean {
  return !!String(value || '').trim();
}

async function loadWorkspaceMetaConfig(workspaceId: string) {
  try {
    const rows = await sql`
      SELECT app_id, config_id
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;
    return rows?.[0] || null;
  } catch (error) {
    console.error('[v0] Failed to load meta config:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Load Meta App config
    let appId = process.env.META_APP_ID || '';
    let configId = process.env.META_CONFIG_ID || '';

    const metaConfig = await loadWorkspaceMetaConfig(workspaceId);

    if (metaConfig) {
      appId = metaConfig.app_id || appId;
      configId = metaConfig.config_id || configId;
    }

    if (!isSet(appId) || !isSet(configId)) {
      return NextResponse.json({
        error: 'Meta app configuration not found',
        url: null,
      }, { status: 400 });
    }

    // IMPORTANT: redirect_uri must match Meta dashboard exactly
    const callbackUrl =
      'https://socialflow-gxnk.vercel.app/api/integrations/facebook-whatsapp/embed-callback';

    // Pass workspaceId via state
    const state = encodeURIComponent(workspaceId);

    console.log('[v0] Providing Facebook App ID and Config ID for workspace:', workspaceId);

    return NextResponse.json({
      appId,
      configId
    });

  } catch (error: any) {
    console.error('[v0] Signup URL error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function requireUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  console.log('[v0] Auth token from cookies:', token);

  if (!token) return null;

  const userId = await verifySession(token);
  console.log('[v0] Verified userId:', userId);

  return userId;
}

async function verifyWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  console.log('[v0] Checking workspace ownership:', { workspaceId, userId });

  const owned = await sql`
    SELECT id
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;

  console.log('[v0] Workspace query result:', owned);

  return Array.isArray(owned) && owned.length > 0;
}

function isSet(value?: string): boolean {
  return !!String(value || '').trim();
}

async function loadWorkspaceMetaConfig(workspaceId: string) {
  try {
    console.log('[v0] Loading Meta config for workspace:', workspaceId);

    const rows = await sql`
      SELECT app_id, config_id
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;

    console.log('[v0] Meta config query result:', rows);

    return rows?.[0] || null;

  } catch (error) {
    console.error('[v0] Failed to load meta config:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[v0] ===== WhatsApp Signup URL Request Started =====');

    await ensureCoreSchema();
    console.log('[v0] Core schema ensured');

    const userId = await requireUserId();

    if (!userId) {
      console.log('[v0] Unauthorized request (no userId)');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    console.log('[v0] Request URL:', request.url);

    const workspaceId = url.searchParams.get('workspaceId');
    console.log('[v0] workspaceId from query:', workspaceId);

    if (!workspaceId) {
      console.log('[v0] Missing workspaceId');
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);

    if (!isOwner) {
      console.log('[v0] Workspace ownership verification failed');
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    console.log('[v0] Workspace ownership verified');

    // Load Meta config
    let appId = process.env.META_APP_ID || '';
    let configId = process.env.META_CONFIG_ID || '';

    console.log('[v0] Env Meta config:', { appId, configId });

    const metaConfig = await loadWorkspaceMetaConfig(workspaceId);

    if (metaConfig) {
      console.log('[v0] Using workspace-specific Meta config:', metaConfig);

      appId = metaConfig.app_id || appId;
      configId = metaConfig.config_id || configId;
    }

    console.log('[v0] Final Meta config:', { appId, configId });

    if (!isSet(appId) || !isSet(configId)) {
      console.log('[v0] Meta configuration missing');

      return NextResponse.json({
        error: 'Meta app configuration not found',
        url: null,
      }, { status: 400 });
    }

    const callbackUrl =
      'https://socialflow-gxnk.vercel.app/api/integrations/facebook-whatsapp/embed-callback';

    console.log('[v0] Callback URL:', callbackUrl);

    const state = encodeURIComponent(workspaceId);

    console.log('[v0] OAuth state value:', state);

    const signupUrl =
      `https://business.facebook.com/messaging/whatsapp/onboard/` +
      `?app_id=${appId}` +
      `&config_id=${configId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${state}` +
      `&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D`;

    console.log('[v0] Generated signup URL:', signupUrl);

    console.log('[v0] ===== Signup URL Generated Successfully =====');

    return NextResponse.json({ url: signupUrl });

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
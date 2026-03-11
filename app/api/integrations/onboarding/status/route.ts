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

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const wsRows = await sql`
      SELECT id, settings
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;
    if (!wsRows || wsRows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const settings = parseSettings(wsRows[0].settings);
    const ownBsp = settings?.ownBsp || {};
    const runtime = await getOwnBspRuntimeInfo(workspaceId);

    const metaRows = await sql`
      SELECT id, is_default, whatsapp_phone_number_id, whatsapp_access_token, instagram_business_account_id, instagram_access_token
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;
    const defaultMetaApp = metaRows?.[0] || null;

    const hasDefaultMetaApp = !!defaultMetaApp;
    const hasWhatsappCredentials =
      !!String(defaultMetaApp?.whatsapp_phone_number_id || process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim() &&
      !!String(defaultMetaApp?.whatsapp_access_token || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
    const hasInstagramCredentials =
      !!String(defaultMetaApp?.instagram_business_account_id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim() &&
      !!String(defaultMetaApp?.instagram_access_token || process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/webhooks/bsp/${workspaceId}`;

    const checks = {
      deliveryModeMeta: runtime.executionMode === 'meta',
      autoProcessEnabled: !!runtime.autoProcess,
      hasDefaultMetaApp,
      hasWhatsappCredentials,
      hasInstagramCredentials,
      webhookConfiguredToken: !!String(process.env.BSP_WEBHOOK_TOKEN || '').trim(),
    };

    const completedSteps = [
      checks.deliveryModeMeta,
      checks.hasDefaultMetaApp && checks.hasWhatsappCredentials,
      checks.webhookConfiguredToken,
      checks.autoProcessEnabled,
    ].filter(Boolean).length;

    return NextResponse.json({
      success: true,
      runtime,
      ownBsp,
      checks,
      webhookUrl,
      progress: {
        completedSteps,
        totalSteps: 4,
        percent: Math.round((completedSteps / 4) * 100),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load onboarding status' },
      { status: 500 }
    );
  }
}

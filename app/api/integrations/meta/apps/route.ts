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

function maskSecret(secret?: string | null): string {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return `${'*'.repeat(Math.max(secret.length - 4, 4))}${secret.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = new URL(request.url).searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const rows = await sql`
      SELECT id, name, app_id, app_secret, config_id, redirect_uri, business_id, webhook_verify_token,
             whatsapp_phone_number_id, whatsapp_access_token, instagram_business_account_id, instagram_access_token,
             is_default, created_at, updated_at
      FROM meta_apps
      WHERE workspace_id = ${workspaceId}
      ORDER BY is_default DESC, created_at ASC
    `;

    const apps = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      appId: r.app_id,
      appSecretMasked: maskSecret(r.app_secret),
      hasAppSecret: !!r.app_secret,
      configId: r.config_id || '',
      redirectUri: r.redirect_uri || '',
      businessId: r.business_id || '',
      webhookVerifyTokenMasked: maskSecret(r.webhook_verify_token),
      hasWebhookVerifyToken: !!r.webhook_verify_token,
      whatsappPhoneNumberId: r.whatsapp_phone_number_id || '',
      whatsappAccessTokenMasked: maskSecret(r.whatsapp_access_token),
      hasWhatsappAccessToken: !!r.whatsapp_access_token,
      instagramBusinessAccountId: r.instagram_business_account_id || '',
      instagramAccessTokenMasked: maskSecret(r.instagram_access_token),
      hasInstagramAccessToken: !!r.instagram_access_token,
      isDefault: !!r.is_default,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ success: true, apps });
  } catch (error: any) {
    console.error('Meta apps GET error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const name = String(body?.name || '').trim();
    const appId = String(body?.appId || '').trim();
    const appSecret = String(body?.appSecret || '').trim();
    const configId = String(body?.configId || '').trim();
    const redirectUri = String(body?.redirectUri || '').trim();
    const businessId = String(body?.businessId || '').trim();
    const webhookVerifyToken = String(body?.webhookVerifyToken || '').trim();
    const whatsappPhoneNumberId = String(body?.whatsappPhoneNumberId || '').trim();
    const whatsappAccessToken = String(body?.whatsappAccessToken || '').trim();
    const instagramBusinessAccountId = String(body?.instagramBusinessAccountId || '').trim();
    const instagramAccessToken = String(body?.instagramAccessToken || '').trim();
    const isDefault = !!body?.isDefault;

    if (!workspaceId || !name || !appId) {
      return NextResponse.json(
        { error: 'workspaceId, name, appId are required' },
        { status: 400 }
      );
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    if (isDefault) {
      await sql`
        UPDATE meta_apps
        SET is_default = false, updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ${workspaceId}
      `;
    }

    const rows = await sql`
      INSERT INTO meta_apps (
        workspace_id, name, app_id, app_secret, config_id, redirect_uri, business_id, webhook_verify_token,
        whatsapp_phone_number_id, whatsapp_access_token, instagram_business_account_id, instagram_access_token, is_default
      )
      VALUES (
        ${workspaceId}, ${name}, ${appId}, ${appSecret || null}, ${configId || null}, ${redirectUri || null},
        ${businessId || null}, ${webhookVerifyToken || null},
        ${whatsappPhoneNumberId || null}, ${whatsappAccessToken || null},
        ${instagramBusinessAccountId || null}, ${instagramAccessToken || null},
        ${isDefault}
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: rows?.[0]?.id || null });
  } catch (error: any) {
    if (String(error?.message || '').includes('meta_apps_workspace_id_app_id_key')) {
      return NextResponse.json(
        { success: false, error: 'App ID already exists in this workspace' },
        { status: 409 }
      );
    }
    console.error('Meta apps POST error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const appRecordId = String(body?.appRecordId || '').trim();
    const action = String(body?.action || '').trim();

    if (!workspaceId || !appRecordId || !action) {
      return NextResponse.json({ error: 'workspaceId, appRecordId, action are required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    if (action === 'set_default') {
      await sql`
        UPDATE meta_apps
        SET is_default = false, updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ${workspaceId}
      `;
      await sql`
        UPDATE meta_apps
        SET is_default = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${appRecordId} AND workspace_id = ${workspaceId}
      `;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Meta apps PATCH error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const appRecordId = String(body?.appRecordId || '').trim();

    if (!workspaceId || !appRecordId) {
      return NextResponse.json({ error: 'workspaceId and appRecordId are required' }, { status: 400 });
    }

    const isOwner = await verifyWorkspaceOwner(workspaceId, userId);
    if (!isOwner) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    await sql`
      DELETE FROM meta_apps
      WHERE id = ${appRecordId} AND workspace_id = ${workspaceId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Meta apps DELETE error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

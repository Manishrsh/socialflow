import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

function isSet(value?: string): boolean {
  return !!String(value || '').trim();
}

async function loadWorkspaceDefaultMetaApp(workspaceId: string, userId: string) {
  const owned = await sql`
    SELECT id
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;
  if (!owned || owned.length === 0) return null;

  const rows = await sql`
    SELECT app_id, app_secret, config_id, redirect_uri, business_id, webhook_verify_token,
           whatsapp_phone_number_id, whatsapp_access_token, instagram_business_account_id, instagram_access_token
    FROM meta_apps
    WHERE workspace_id = ${workspaceId}
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `;
  return rows?.[0] || null;
}

export async function GET(request: NextRequest) {
  await ensureCoreSchema();
  const workspaceId = new URL(request.url).searchParams.get('workspaceId');

  let appId = process.env.META_APP_ID || '';
  let appSecret = process.env.META_APP_SECRET || '';
  let configId = process.env.META_CONFIG_ID || '';
  let redirectUri = process.env.META_REDIRECT_URI || '';
  let businessId = process.env.META_BUSINESS_ID || '';
  let webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
  let waPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';
  let waAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN || '';
  let igBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
  let igAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN || '';
  const apiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0';

  if (workspaceId) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    const userId = token ? await verifySession(token) : null;
    if (userId) {
      const defaultMetaApp = await loadWorkspaceDefaultMetaApp(workspaceId, userId);
      if (defaultMetaApp) {
        appId = defaultMetaApp.app_id || appId;
        appSecret = defaultMetaApp.app_secret || appSecret;
        configId = defaultMetaApp.config_id || configId;
        redirectUri = defaultMetaApp.redirect_uri || redirectUri;
        businessId = defaultMetaApp.business_id || businessId;
        webhookVerifyToken = defaultMetaApp.webhook_verify_token || webhookVerifyToken;
        waPhoneNumberId = defaultMetaApp.whatsapp_phone_number_id || waPhoneNumberId;
        waAccessToken = defaultMetaApp.whatsapp_access_token || waAccessToken;
        igBusinessAccountId = defaultMetaApp.instagram_business_account_id || igBusinessAccountId;
        igAccessToken = defaultMetaApp.instagram_access_token || igAccessToken;
      }
    }
  }

  const whatsappEmbeddedSignupUrl =
    isSet(appId) && isSet(configId)
      ? `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D`
      : '';

  const instagramConnectUrl =
    isSet(appId) && isSet(redirectUri)
      ? `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=instagram_manage_messages,pages_manage_metadata&response_type=code`
      : '';

  const checks = {
    META_APP_ID: isSet(appId),
    META_APP_SECRET: isSet(appSecret),
    META_CONFIG_ID: isSet(configId),
    META_REDIRECT_URI: isSet(redirectUri),
    META_BUSINESS_ID: isSet(businessId),
    META_WEBHOOK_VERIFY_TOKEN: isSet(webhookVerifyToken),
    META_WHATSAPP_PHONE_NUMBER_ID: isSet(waPhoneNumberId),
    META_WHATSAPP_ACCESS_TOKEN: isSet(waAccessToken),
    INSTAGRAM_BUSINESS_ACCOUNT_ID: isSet(igBusinessAccountId),
    INSTAGRAM_ACCESS_TOKEN: isSet(igAccessToken),
  };

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  return NextResponse.json({
    success: true,
    configured: missing.length === 0,
    checks,
    missing,
    urls: {
      whatsappEmbeddedSignupUrl,
      instagramConnectUrl,
    },
    source: workspaceId ? 'workspace_default_or_env' : 'env',
  });
}

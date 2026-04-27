import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { randomUUID } from 'crypto';

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

async function authUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await authUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const rows = await sql`
      SELECT id, name, settings
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = rows[0];
    const settings = parseSettings(workspace.settings);
    const apiKey = String(settings?.apiKey || '');
    const branding = {
      businessName: String(settings?.businessName || workspace.name || '').trim(),
      logoUrl: String(settings?.logoUrl || '').trim(),
      brandColorPrimary: String(settings?.brandColorPrimary || '').trim(),
      brandColorSecondary: String(settings?.brandColorSecondary || '').trim(),
      phoneNumber: String(settings?.phoneNumber || settings?.whatsappPhoneNumber || '').trim(),
      address: String(settings?.address || '').trim(),
      socialHandle: String(settings?.socialHandle || '').trim(),
      tagline: String(settings?.tagline || '').trim(),
      industry: String(settings?.industry || '').trim(),
      calendarPostingPaused: !!settings?.calendarPostingPaused,
    };

    return NextResponse.json({
      success: true,
      data: {
        workspaceName: workspace.name || '',
        whatsappPhoneNumber: String(settings?.whatsappPhoneNumber || ''),
        webhookUrl: String(settings?.webhookUrl || ''),
        apiKeyMasked: apiKey ? `${'*'.repeat(Math.max(8, apiKey.length - 4))}${apiKey.slice(-4)}` : '',
        hasApiKey: !!apiKey,
        branding,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();
    const userId = await authUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const workspaceName = String(body?.workspaceName || '').trim();
    const whatsappPhoneNumber = String(body?.whatsappPhoneNumber || '').trim();
    const webhookUrl = String(body?.webhookUrl || '').trim();
    const regenerateApiKey = !!body?.regenerateApiKey;
    const businessName = String(body?.businessName || '').trim();
    const logoUrl = String(body?.logoUrl || '').trim();
    const brandColorPrimary = String(body?.brandColorPrimary || '').trim();
    const brandColorSecondary = String(body?.brandColorSecondary || '').trim();
    const phoneNumber = String(body?.phoneNumber || '').trim();
    const address = String(body?.address || '').trim();
    const socialHandle = String(body?.socialHandle || '').trim();
    const tagline = String(body?.tagline || '').trim();
    const industry = String(body?.industry || '').trim();
    const calendarPostingPaused = !!body?.calendarPostingPaused;

    if (!workspaceId || !workspaceName) {
      return NextResponse.json({ error: 'workspaceId and workspaceName are required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, settings
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const current = rows[0];
    const settings = parseSettings(current.settings);
    const nextApiKey = regenerateApiKey
      ? `wk_${randomUUID().replace(/-/g, '')}`
      : String(settings?.apiKey || '');

    const nextSettings = {
      ...settings,
      whatsappPhoneNumber,
      webhookUrl,
      apiKey: nextApiKey,
      businessName: businessName || settings?.businessName || workspaceName,
      logoUrl,
      brandColorPrimary,
      brandColorSecondary,
      phoneNumber,
      address,
      socialHandle,
      tagline,
      industry,
      calendarPostingPaused,
    };

    await sql`
      UPDATE workspaces
      SET
        name = ${workspaceName},
        settings = ${JSON.stringify(nextSettings)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${workspaceId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        workspaceName,
        whatsappPhoneNumber,
        webhookUrl,
        apiKey: nextApiKey || null,
        branding: {
          businessName: nextSettings.businessName || workspaceName,
          logoUrl,
          brandColorPrimary,
          brandColorSecondary,
          phoneNumber,
          address,
          socialHandle,
          tagline,
          industry,
          calendarPostingPaused,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to save settings' }, { status: 500 });
  }
}

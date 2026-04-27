import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import {
  buildCalendarCreative,
  getBrandingSettings,
  normalizePlanTier,
  resolveScheduleTime,
} from '@/lib/calendar-marketing';

async function requireUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

async function loadWorkspaceContext(workspaceId: string, userId: string) {
  const rows = await sql`
    SELECT w.id, w.name, w.settings, u.subscription_tier
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    WHERE w.id = ${workspaceId} AND w.owner_id = ${userId}
    LIMIT 1
  `;
  return rows?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const eventName = String(body?.eventName || '').trim();
    const eventDate = String(body?.eventDate || '').trim();
    const eventType = String(body?.eventType || 'Custom').trim();
    const sourceKind = String(body?.sourceKind || 'custom').trim() === 'festival' ? 'festival' : 'custom';
    const festivalTone = String(body?.festivalTone || '').trim();
    const logoUrl = String(body?.logoUrl || '').trim();
    const repeatYearly = !!body?.repeatYearly;

    if (!workspaceId || !eventName || !eventDate || !eventType) {
      return NextResponse.json({ error: 'workspaceId, eventName, eventDate, and eventType are required' }, { status: 400 });
    }

    const workspace = await loadWorkspaceContext(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const branding = getBrandingSettings(workspace);
    const tier = normalizePlanTier(workspace.subscription_tier);
    const creative = buildCalendarCreative({
      eventName,
      eventDate,
      eventType,
      branding: {
        ...branding,
        logoUrl: logoUrl || branding.logoUrl,
      },
      sourceKind,
      festivalTone: festivalTone || undefined,
    });

    const scheduledFor = resolveScheduleTime({
      eventDate,
      repeatYearly,
      eventType,
      currentTier: tier,
    }).toISOString();

    return NextResponse.json({
      success: true,
      preview: {
        title: creative.title,
        caption: creative.caption,
        creativeSvg: creative.creativeSvg,
        scheduledFor,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] Preview error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to generate preview' }, { status: 500 });
  }
}

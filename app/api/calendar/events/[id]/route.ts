import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import {
  buildCalendarCreative,
  buildCreativePreviewUrl,
  deriveEventStatus,
  getBrandingSettings,
  resolveScheduleTime,
} from '@/lib/calendar-marketing';

type RouteParams = { params: Promise<{ id: string }> };

function getPublicOrigin(request: NextRequest): string {
  const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
  const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const envBaseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');

  return new URL(request.url).origin;
}

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

async function createEventPost(input: {
  workspaceId: string;
  calendarEventId: string;
  eventName: string;
  eventDate: string;
  eventType: string;
  logoUrl: string | null;
  branding: ReturnType<typeof getBrandingSettings>;
  requestOrigin: string;
  isEnabled: boolean;
  repeatYearly: boolean;
}) {
  const postId = uuidv4();
  const creative = buildCalendarCreative({
    eventName: input.eventName,
    eventDate: input.eventDate,
    eventType: input.eventType,
    branding: {
      ...input.branding,
      logoUrl: input.logoUrl || input.branding.logoUrl,
    },
    sourceKind: 'custom',
  });
  const scheduledFor = input.isEnabled
    ? resolveScheduleTime({
        eventDate: input.eventDate,
        repeatYearly: input.repeatYearly,
        eventType: input.eventType,
      }).toISOString()
    : null;

  const previewUrl = buildCreativePreviewUrl(input.requestOrigin, postId);
  await sql`
    INSERT INTO calendar_event_posts (
      id, workspace_id, calendar_event_id, source_kind, event_name, event_date,
      post_title, caption, creative_svg, creative_preview_url, scheduled_for, status, engagement_status
    )
    VALUES (
      ${postId}, ${input.workspaceId}, ${input.calendarEventId}, 'custom',
      ${input.eventName}, ${input.eventDate},
      ${creative.title}, ${creative.caption}, ${creative.creativeSvg}, ${previewUrl}, ${scheduledFor},
      ${input.isEnabled ? 'scheduled' : 'draft'}, ${input.isEnabled ? 'scheduled' : 'pending'}
    )
  `;

  return {
    postId,
    previewUrl,
    ...creative,
    scheduledFor,
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureCoreSchema();

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const name = String(body?.eventName || '').trim();
    const eventDate = String(body?.eventDate || '').trim();
    const eventType = String(body?.eventType || 'Custom').trim();
    const repeatYearly = typeof body?.repeatYearly === 'boolean' ? !!body?.repeatYearly : undefined;
    const logoUrl = typeof body?.logoUrl === 'string' ? String(body.logoUrl || '').trim() : undefined;
    const notes = typeof body?.notes === 'string' ? String(body.notes || '').trim() : undefined;
    const isEnabled = typeof body?.isEnabled === 'boolean' ? !!body?.isEnabled : undefined;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const workspace = await loadWorkspaceContext(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const existingRows = await sql`
      SELECT id, name, event_date, event_type, repeat_yearly, logo_url, notes, is_enabled
      FROM calendar_events
      WHERE id = ${id} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
      LIMIT 1
    `;
    const existing = existingRows?.[0];
    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const currentBranding = getBrandingSettings(workspace);
    const nextEvent = {
      name: name || existing.name,
      eventDate: eventDate || existing.event_date,
      eventType: eventType || existing.event_type,
      repeatYearly: typeof repeatYearly === 'boolean' ? repeatYearly : !!existing.repeat_yearly,
      logoUrl: typeof logoUrl === 'string' ? logoUrl : existing.logo_url || null,
      notes: typeof notes === 'string' ? notes : existing.notes || null,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : !!existing.is_enabled,
    };

    await sql`
      UPDATE calendar_events
      SET
        name = ${nextEvent.name},
        event_date = ${nextEvent.eventDate},
        event_type = ${nextEvent.eventType},
        repeat_yearly = ${nextEvent.repeatYearly},
        logo_url = ${nextEvent.logoUrl || null},
        notes = ${nextEvent.notes || null},
        is_enabled = ${nextEvent.isEnabled},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND workspace_id = ${workspaceId}
    `;

    await sql`
      UPDATE calendar_event_posts
      SET status = 'disabled', disabled_reason = 'Event disabled', updated_at = CURRENT_TIMESTAMP
      WHERE calendar_event_id = ${id} AND workspace_id = ${workspaceId} AND status IN ('draft', 'scheduled')
    `;

    let post: Awaited<ReturnType<typeof createEventPost>> | null = null;
    if (nextEvent.isEnabled) {
      post = await createEventPost({
        workspaceId,
        calendarEventId: id,
        eventName: nextEvent.name,
        eventDate: nextEvent.eventDate,
        eventType: nextEvent.eventType,
        logoUrl: nextEvent.logoUrl,
        branding: currentBranding,
        requestOrigin: getPublicOrigin(request),
        isEnabled: true,
        repeatYearly: nextEvent.repeatYearly,
      });
    }

    const latestPostRows = await sql`
      SELECT status, scheduled_for, posted_at, instagram_post_id, engagement_status, failure_reason, creative_preview_url, caption, post_title
      FROM calendar_event_posts
      WHERE calendar_event_id = ${id} AND workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const latestPost = post
      ? {
          status: 'scheduled',
          scheduled_for: post.scheduledFor,
          posted_at: null,
          instagram_post_id: null,
          engagement_status: 'scheduled',
          failure_reason: null,
          creative_preview_url: post.previewUrl,
          caption: post.caption,
          post_title: post.title,
        }
      : latestPostRows?.[0] || null;

    return NextResponse.json({
      success: true,
      event: {
        id,
        sourceKind: 'custom',
        sourceKey: id,
        name: nextEvent.name,
        eventDate: nextEvent.eventDate,
        eventType: nextEvent.eventType,
        repeatYearly: nextEvent.repeatYearly,
        isEnabled: nextEvent.isEnabled,
        status: deriveEventStatus({
          isEnabled: nextEvent.isEnabled,
          eventDate: nextEvent.eventDate,
          post: latestPost,
          paused: currentBranding.calendarPostingPaused,
        }),
        labelColor: 'blue',
        logoUrl: nextEvent.logoUrl || currentBranding.logoUrl || null,
        notes: nextEvent.notes || null,
        post: latestPost
          ? {
              id: post?.postId || latestPost.id || null,
              status: latestPost.status || 'draft',
              scheduledFor: latestPost.scheduled_for || null,
              postedAt: latestPost.posted_at || null,
              instagramPostId: latestPost.instagram_post_id || null,
              engagementStatus: latestPost.engagement_status || 'pending',
              failureReason: latestPost.failure_reason || null,
              creativePreviewUrl: latestPost.creative_preview_url || null,
              caption: latestPost.caption || '',
              postTitle: latestPost.post_title || '',
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] PATCH event error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureCoreSchema();

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const workspaceId = String(body?.workspaceId || '').trim();
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const workspace = await loadWorkspaceContext(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    await sql`
      UPDATE calendar_events
      SET deleted_at = CURRENT_TIMESTAMP, is_enabled = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
    `;

    await sql`
      UPDATE calendar_event_posts
      SET status = 'disabled', disabled_reason = 'Event deleted', updated_at = CURRENT_TIMESTAMP
      WHERE calendar_event_id = ${id} AND workspace_id = ${workspaceId} AND status IN ('draft', 'scheduled')
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Calendar] DELETE event error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete event' }, { status: 500 });
  }
}

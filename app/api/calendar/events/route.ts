import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { getDaysInMonth } from 'date-fns';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import {
  buildCalendarCreative,
  buildCreativePreviewUrl,
  deriveEventStatus,
  getBrandingSettings,
  getFestivalAvailability,
  getMonthlyFestivalOccurrences,
  getPlanLimits,
  normalizePlanTier,
  resolveScheduleTime,
  CALENDAR_FESTIVALS,
} from '@/lib/calendar-marketing';

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

function parseMonth(value: string | null) {
  if (!value) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  return { year: Number(match[1]), month: Number(match[2]) };
}

function toDateKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function mapPostSummary(post: any) {
  if (!post) return null;
  return {
    id: post.id,
    status: post.status,
    scheduledFor: post.scheduled_for ? new Date(post.scheduled_for).toISOString() : null,
    postedAt: post.posted_at ? new Date(post.posted_at).toISOString() : null,
    instagramPostId: post.instagram_post_id || null,
    engagementStatus: post.engagement_status || 'pending',
    failureReason: post.failure_reason || null,
    creativePreviewUrl: post.creative_preview_url || null,
    caption: post.caption || '',
    postTitle: post.post_title || '',
  };
}

function buildMonthCustomEventRows(input: {
  customEvents: any[];
  postsByEventId: Map<string, any>;
  year: number;
  month: number;
  brandingPaused: boolean;
}) {
  return input.customEvents
    .map((event) => {
      const rawDate = new Date(event.event_date);
      const isRecurring = !!event.repeat_yearly;
      const daysInMonth = getDaysInMonth(new Date(input.year, input.month - 1, 1));
      const recurringDay = Math.min(rawDate.getDate(), daysInMonth);
      const actualDate = isRecurring
        ? new Date(input.year, input.month - 1, recurringDay)
        : rawDate;
      if (actualDate.getFullYear() !== input.year || actualDate.getMonth() + 1 !== input.month) {
        return null;
      }

      const post = input.postsByEventId.get(String(event.id)) || null;
      const status = deriveEventStatus({
        isEnabled: !!event.is_enabled,
        eventDate: actualDate.toISOString(),
        post: post
          ? {
            status: post.status,
            postedAt: post.posted_at,
            scheduledFor: post.scheduled_for,
          }
          : null,
        paused: input.brandingPaused,
      });

      return {
        id: event.id,
        sourceKind: 'custom' as const,
        sourceKey: event.id,
        name: event.name,
        eventDate: actualDate.toISOString().slice(0, 10),
        eventType: event.event_type,
        repeatYearly: !!event.repeat_yearly,
        isEnabled: !!event.is_enabled,
        status,
        labelColor: 'blue' as const,
        logoUrl: event.logo_url || null,
        customImageUrl: event.custom_image_url || null,
        notes: event.notes || null,
        post: mapPostSummary(post),
      };
    })
    .filter(Boolean);
}

function buildFestivalRows(input: {
  year: number;
  month: number;
  tier: ReturnType<typeof normalizePlanTier>;
  brandingPaused: boolean;
  postsByFestivalKey: Map<string, any>;
}) {
  return getMonthlyFestivalOccurrences(input.year, input.month, input.tier)
    .map((festival) => {
      const definition = CALENDAR_FESTIVALS.find((item) => item.key === festival.festivalKey);
      if (!definition) return null;
      const post = input.postsByFestivalKey.get(String(definition.key)) || null;
      const enabledByPlan = getFestivalAvailability(input.tier, definition);
      const status = deriveEventStatus({
        isEnabled: enabledByPlan,
        eventDate: festival.eventDate,
        post: post
          ? {
            status: post.status,
            postedAt: post.posted_at,
            scheduledFor: post.scheduled_for,
          }
          : null,
        paused: input.brandingPaused,
      });

      return {
        id: festival.id,
        sourceKind: 'festival' as const,
        sourceKey: definition.key,
        festivalKey: definition.key,
        name: definition.name,
        eventDate: festival.eventDate,
        eventType: definition.category,
        repeatYearly: true,
        isEnabled: enabledByPlan,
        status,
        labelColor: 'green' as const,
        notes: definition.tone,
        post: mapPostSummary(post),
      };
    })
    .filter(Boolean);
}

async function createEventPost(input: {
  workspaceId: string;
  calendarEventId: string;
  eventName: string;
  eventDate: string;
  eventType: string;
  sourceKind: 'custom';
  logoUrl: string | null;
  customImageUrl?: string | null;
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
    sourceKind: input.sourceKind,
    festivalTone: undefined,
  });
  const scheduledFor = input.isEnabled
    ? resolveScheduleTime({
      eventDate: input.eventDate,
      repeatYearly: input.repeatYearly,
      eventType: input.eventType,
    }).toISOString()
    : null;

  const previewUrl = input.customImageUrl || buildCreativePreviewUrl(input.requestOrigin, postId);
  const finalSvg = input.customImageUrl ? '' : creative.creativeSvg;
  await sql`
    INSERT INTO calendar_event_posts (
      id, workspace_id, calendar_event_id, source_kind, event_name, event_date,
      post_title, caption, creative_svg, creative_preview_url, scheduled_for, status, engagement_status
    )
    VALUES (
      ${postId}, ${input.workspaceId}, ${input.calendarEventId}, ${input.sourceKind},
      ${input.eventName}, ${input.eventDate},
      ${creative.title}, ${creative.caption}, ${finalSvg}, ${previewUrl}, ${scheduledFor},
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

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    try {
      await sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS custom_image_url VARCHAR(1000)`;
    } catch (e) {
      // Ignore if exists
    }

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const workspaceId = String(searchParams.get('workspaceId') || '').trim();
    const monthInput = searchParams.get('month');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const workspace = await loadWorkspaceContext(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const { year, month } = parseMonth(monthInput);
    const branding = getBrandingSettings(workspace);
    const tier = normalizePlanTier(workspace.subscription_tier);
    const limits = getPlanLimits(tier);

    const customEvents = await sql`
      SELECT id, name, event_date, event_type, repeat_yearly, logo_url, custom_image_url, notes, is_enabled, created_at, updated_at
      FROM calendar_events
      WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
      ORDER BY event_date ASC, created_at DESC
    `;

    const monthPosts = await sql`
      SELECT id, calendar_event_id, festival_key, source_kind, event_name, event_date, post_title, caption,
             creative_svg, creative_preview_url, scheduled_for, posted_at, instagram_post_id,
             status, engagement_status, retry_count, failure_reason, disabled_reason, created_at, updated_at
      FROM calendar_event_posts
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const postsByEventId = new Map<string, any>();
    const postsByFestivalKey = new Map<string, any>();
    for (const post of monthPosts || []) {
      if (post.calendar_event_id && !postsByEventId.has(String(post.calendar_event_id))) {
        postsByEventId.set(String(post.calendar_event_id), post);
      }
      if (post.festival_key && !postsByFestivalKey.has(String(post.festival_key))) {
        postsByFestivalKey.set(String(post.festival_key), post);
      }
    }

    const customRows = buildMonthCustomEventRows({
      customEvents,
      postsByEventId,
      year,
      month,
      brandingPaused: branding.calendarPostingPaused,
    });

    const festivalRows = buildFestivalRows({
      year,
      month,
      tier,
      brandingPaused: branding.calendarPostingPaused,
      postsByFestivalKey,
    });

    const events = [...festivalRows, ...customRows].sort((a: any, b: any) => {
      const dateDiff = String(a.eventDate).localeCompare(String(b.eventDate));
      if (dateDiff !== 0) return dateDiff;
      if (a.sourceKind === b.sourceKind) return String(a.name).localeCompare(String(b.name));
      return a.sourceKind === 'festival' ? -1 : 1;
    });

    const upcomingCount = monthPosts.filter((post: any) => ['draft', 'scheduled'].includes(String(post.status || '').toLowerCase())).length;
    const pastCount = monthPosts.filter((post: any) => String(post.status || '').toLowerCase() === 'posted').length;
    const failedCount = monthPosts.filter((post: any) => String(post.status || '').toLowerCase() === 'failed').length;

    return NextResponse.json({
      success: true,
      calendar: {
        workspaceId,
        workspaceName: workspace.name,
        year,
        month,
        monthLabel: `${year}-${String(month).padStart(2, '0')}`,
        planTier: tier,
        planLimits: {
          customEvents: Number.isFinite(limits.customEvents) ? limits.customEvents : null,
          festivalMode: limits.festivalMode,
          advancedBranding: limits.advancedBranding,
        },
        branding,
        events,
        customEventCount: customEvents.length,
        festivalCount: festivalRows.length,
        postingPaused: branding.calendarPostingPaused,
        upcomingCount,
        pastCount,
        failedCount,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] GET events error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load calendar events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    try {
      await sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS custom_image_url VARCHAR(1000)`;
    } catch (e) {
      // Ignore if exists
    }

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const name = String(body?.eventName || '').trim();
    const eventDate = String(body?.eventDate || '').trim();
    const eventType = String(body?.eventType || 'Custom').trim();
    const repeatYearly = !!body?.repeatYearly;
    const logoUrl = String(body?.logoUrl || '').trim();
    const customImageUrl = String(body?.customImageUrl || '').trim();
    const notes = String(body?.notes || '').trim();
    const isEnabled = !!body?.isEnabled;

    if (!workspaceId || !name || !eventDate || !eventType) {
      return NextResponse.json({ error: 'workspaceId, eventName, eventDate, and eventType are required' }, { status: 400 });
    }

    const workspace = await loadWorkspaceContext(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const tier = normalizePlanTier(workspace.subscription_tier);
    const limits = getPlanLimits(tier);
    const branding = getBrandingSettings(workspace);
    const requestOrigin = getPublicOrigin(request);

    const customEventCountRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM calendar_events
      WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
    `;
    const currentCount = Number(customEventCountRows?.[0]?.count || 0);
    if (currentCount >= limits.customEvents) {
      return NextResponse.json(
        { error: `Your ${tier} plan allows up to ${limits.customEvents} custom events` },
        { status: 403 }
      );
    }

    const duplicate = await sql`
      SELECT id
      FROM calendar_events
      WHERE workspace_id = ${workspaceId}
        AND deleted_at IS NULL
        AND LOWER(name) = LOWER(${name})
        AND event_date = ${eventDate}
      LIMIT 1
    `;
    if (duplicate && duplicate.length > 0) {
      return NextResponse.json({ error: 'An event with the same name already exists on this date' }, { status: 409 });
    }

    const eventId = uuidv4();
    await sql`
      INSERT INTO calendar_events (
        id, workspace_id, name, event_date, event_type, repeat_yearly, logo_url, custom_image_url, notes, is_enabled, created_by
      )
      VALUES (
        ${eventId}, ${workspaceId}, ${name}, ${eventDate}, ${eventType}, ${repeatYearly},
        ${logoUrl || null}, ${customImageUrl || null}, ${notes || null}, ${isEnabled}, ${userId}
      )
    `;

    const post = isEnabled
      ? await createEventPost({
        workspaceId,
        calendarEventId: eventId,
        eventName: name,
        eventDate,
        eventType,
        sourceKind: 'custom',
        logoUrl: logoUrl || null,
        customImageUrl: customImageUrl || null,
        branding,
        requestOrigin,
        isEnabled,
        repeatYearly,
      })
      : null;

    const eventStatus = deriveEventStatus({
      isEnabled,
      eventDate,
      post: post
        ? {
          status: 'scheduled',
          scheduledFor: post.scheduledFor,
        }
        : null,
      paused: branding.calendarPostingPaused,
    });

    return NextResponse.json({
      success: true,
      event: {
        id: eventId,
        sourceKind: 'custom',
        sourceKey: eventId,
        name,
        eventDate: toDateKey(eventDate),
        eventType,
        repeatYearly,
        isEnabled,
        status: eventStatus,
        labelColor: 'blue',
        logoUrl: logoUrl || branding.logoUrl || null,
        customImageUrl: customImageUrl || null,
        notes: notes || null,
        post: post
          ? {
            id: post.postId,
            status: 'scheduled',
            scheduledFor: post.scheduledFor,
            postedAt: null,
            instagramPostId: null,
            engagementStatus: 'scheduled',
            failureReason: null,
            creativePreviewUrl: post.previewUrl,
            caption: post.caption,
            postTitle: post.title,
          }
          : null,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] POST event error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create event' }, { status: 500 });
  }
}

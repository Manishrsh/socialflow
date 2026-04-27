import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

async function requireUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifySession(token);
}

async function loadWorkspaceOwner(workspaceId: string, userId: string) {
  const rows = await sql`
    SELECT id, name
    FROM workspaces
    WHERE id = ${workspaceId} AND owner_id = ${userId}
    LIMIT 1
  `;
  return rows?.[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const workspaceId = String(searchParams.get('workspaceId') || '').trim();
    const status = String(searchParams.get('status') || '').trim();
    const limit = Math.min(100, Number(searchParams.get('limit') || 20));

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const workspace = await loadWorkspaceOwner(workspaceId, userId);
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    let query = sql`
      SELECT id, calendar_event_id, festival_key, source_kind, event_name, event_date, post_title, caption,
             creative_svg, creative_preview_url, scheduled_for, posted_at, instagram_post_id,
             status, engagement_status, retry_count, failure_reason, disabled_reason, created_at, updated_at
      FROM calendar_event_posts
      WHERE workspace_id = ${workspaceId}
    `;

    if (status) {
      query = sql`${query} AND status = ${status}`;
    }

    query = sql`${query} ORDER BY COALESCE(scheduled_for, posted_at, created_at) DESC LIMIT ${limit}`;
    const rows = await query;

    const posts = (rows || []).map((row: any) => ({
      id: row.id,
      calendarEventId: row.calendar_event_id || null,
      festivalKey: row.festival_key || null,
      sourceKind: row.source_kind,
      eventName: row.event_name,
      eventDate: row.event_date,
      postTitle: row.post_title,
      caption: row.caption,
      creativePreviewUrl: row.creative_preview_url,
      scheduledFor: row.scheduled_for || null,
      postedAt: row.posted_at || null,
      instagramPostId: row.instagram_post_id || null,
      status: row.status,
      engagementStatus: row.engagement_status || 'pending',
      retryCount: Number(row.retry_count || 0),
      failureReason: row.failure_reason || null,
      disabledReason: row.disabled_reason || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const upcomingPosts = posts.filter((post) => ['draft', 'scheduled'].includes(String(post.status).toLowerCase()));
    const pastPosts = posts.filter((post) => String(post.status).toLowerCase() === 'posted');
    const failedPosts = posts.filter((post) => String(post.status).toLowerCase() === 'failed');

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      posts,
      upcomingPosts,
      pastPosts,
      failedPosts,
      engagementStatus: {
        total: posts.length,
        posted: pastPosts.length,
        failed: failedPosts.length,
        scheduled: upcomingPosts.length,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] Posts GET error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load posts' }, { status: 500 });
  }
}

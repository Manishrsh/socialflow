import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { v4 as uuidv4 } from 'uuid';
import {
  CALENDAR_FESTIVALS,
  buildCalendarCreative,
  buildCreativePreviewUrl,
  getBrandingSettings,
  getFestivalAvailability,
  normalizePlanTier,
  resolveScheduleTime,
} from '@/lib/calendar-marketing';
import { publishInstagramImage } from '@/lib/instagram';

// مشتر handler for GET & POST
async function handler(request: NextRequest) {
  console.log('[CRON] HIT');

  try {
    // ✅ Allow Vercel Cron + manual testing
    const isCron = request.headers.get('x-vercel-cron');
    const isDev = process.env.NODE_ENV === 'development';

    // if (!isCron && !isDev) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const isDryRun = process.env.DRY_RUN === 'true' || request.nextUrl.searchParams.get('dryRun') === 'true';
    const forcePostId = request.nextUrl.searchParams.get('forcePostId');

    console.log('[CRON] Processing scheduled messages...');
    if (isDryRun) console.log('[CRON] 🏜️ DRY RUN MODE ENABLED: Database will not be modified.');

    await ensureCoreSchema();

    const messagesReady = await sql`
      SELECT 
        sm.id,
        sm.workspace_id,
        sm.customer_id,
        sm.phone,
        sm.message,
        sm.scheduled_at,
        sm.schedule_mode,
        sm.delay_hours,
        sm.delay_minutes,
        sm.created_at,
        c.last_user_message_at
      FROM scheduled_messages sm
      LEFT JOIN customers c ON sm.customer_id = c.id
      WHERE sm.status = 'pending'
      ORDER BY sm.scheduled_at ASC
      LIMIT 100
    `;

    console.log(`[CRON] Found ${messagesReady.length} messages`);

    const processedMessages = [];
    const now = new Date();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    for (const msg of messagesReady) {
      try {
        const createdAt = new Date(msg.created_at);
        const messageAge = now.getTime() - createdAt.getTime();

        // ✅ Expire after 24 hours
        if (messageAge > twentyFourHoursMs) {
          if (isDryRun) {
            console.log(`[CRON] DRY RUN: Would expire scheduled_message ${msg.id}`);
          } else {
            await sql`
              UPDATE scheduled_messages
              SET status = 'expired', updated_at = CURRENT_TIMESTAMP
              WHERE id = ${msg.id}
            `;
          }
          continue;
        }

        const lastUserMessageTime = msg.last_user_message_at
          ? new Date(msg.last_user_message_at)
          : null;

        const timeSinceLastMessage = lastUserMessageTime
          ? now.getTime() - lastUserMessageTime.getTime()
          : Infinity;

        let shouldSendNow = false;
        let actualScheduledTime = new Date(msg.scheduled_at);

        if (msg.schedule_mode === 'delay' && lastUserMessageTime) {
          const delayMs =
            ((msg.delay_hours || 0) * 60 * 60 * 1000) +
            ((msg.delay_minutes || 0) * 60 * 1000);

          actualScheduledTime = new Date(
            lastUserMessageTime.getTime() + delayMs
          );

          shouldSendNow = now >= actualScheduledTime;
        } else {
          shouldSendNow = now >= actualScheduledTime;
        }

        const isWithin24Hours = timeSinceLastMessage < twentyFourHoursMs;

        // ✅ FIXED LOGIC
        if (shouldSendNow || msg.id === forcePostId) {
          if (!isWithin24Hours) {
            console.log(`[CRON] Waiting (user inactive) ${msg.id}`);
            continue; // ⏳ wait, don’t skip
          }

          // 🚀 SEND MESSAGE
          const messageId = uuidv4();

          if (isDryRun) {
            console.log(`[CRON] DRY RUN: Would insert message ${messageId} and mark scheduled_message ${msg.id} as sent`);
          } else {
            await sql`
              INSERT INTO messages (
                id, workspace_id, customer_id, direction, type, content, sent_at, created_at
              ) VALUES (
                ${messageId},
                ${msg.workspace_id},
                ${msg.customer_id},
                'outbound',
                'text',
                ${msg.message},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
            `;

            await sql`
              UPDATE scheduled_messages
              SET status = 'sent', updated_at = CURRENT_TIMESTAMP
              WHERE id = ${msg.id}
            `;

            try {
              await pusherServer.trigger(
                `workspace-${msg.workspace_id}`,
                'scheduled-message-sent',
                {
                  scheduledMessageId: msg.id,
                  messageId,
                  customerId: msg.customer_id,
                  content: msg.message,
                  sentAt: new Date(),
                }
              );
            } catch (err) {
              console.error('[CRON] Pusher error:', err);
            }
          }

          processedMessages.push({ id: msg.id, status: 'sent' });
          console.log(`[CRON] Sent ${msg.id}`);
        }
      } catch (error) {
        console.error(`[CRON] Error processing ${msg.id}`, error);

        if (isDryRun) {
          console.log(`[CRON] DRY RUN: Would mark scheduled_message ${msg.id} as error. Reason: ${String(error)}`);
        } else {
          await sql`
            UPDATE scheduled_messages
            SET status = 'error', error_message = ${String(error)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${msg.id}
          `;
        }
      }
    }

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const allWorkspaces = await sql`
      SELECT w.id, w.name, w.settings, u.subscription_tier
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      ORDER BY w.created_at ASC
    `;

    const publicOrigin = (() => {
      const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
      const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();
      if (forwardedProto && forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
      }
      const envBaseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
      if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');
      return new URL(request.url).origin;
    })();

    const festivalSeeds: Array<{ workspaceId: string; key: string }> = [];
    for (const workspace of allWorkspaces || []) {
      const branding = getBrandingSettings(workspace);
      if (branding.calendarPostingPaused) {
        continue;
      }

      const tier = normalizePlanTier(workspace.subscription_tier);
      for (const festival of CALENDAR_FESTIVALS) {
        if (!getFestivalAvailability(tier, festival)) continue;
        if (festival.month !== today.getMonth() + 1 || festival.day !== today.getDate()) continue;

        const existing = await sql`
          SELECT id
          FROM calendar_event_posts
          WHERE workspace_id = ${workspace.id}
            AND source_kind = 'festival'
            AND festival_key = ${festival.key}
            AND event_date = ${todayKey}
          LIMIT 1
        `;
        if (existing && existing.length > 0) continue;

        const postId = uuidv4();
        const creative = buildCalendarCreative({
          eventName: festival.name,
          eventDate: todayKey,
          eventType: 'Festival',
          branding,
          sourceKind: 'festival',
          festivalTone: festival.tone,
        });
        const scheduledFor = resolveScheduleTime({
          eventDate: todayKey,
          repeatYearly: true,
          eventType: 'festival',
          currentTier: tier,
        }).toISOString();

        if (isDryRun) {
          console.log(`[CRON] DRY RUN: Would seed festival post for workspace ${workspace.id}, festival ${festival.key}`);
        } else {
          await sql`
            INSERT INTO calendar_event_posts (
              id, workspace_id, source_kind, festival_key, event_name, event_date,
              post_title, caption, creative_svg, creative_preview_url, scheduled_for, status, engagement_status
            )
            VALUES (
              ${postId}, ${workspace.id}, 'festival', ${festival.key}, ${festival.name}, ${todayKey},
              ${creative.title}, ${creative.caption}, ${creative.creativeSvg},
              ${buildCreativePreviewUrl(publicOrigin, postId)}, ${scheduledFor}, 'scheduled', 'scheduled'
            )
          `;
        }
        festivalSeeds.push({ workspaceId: workspace.id, key: festival.key });
      }
    }

    const dueCalendarPosts = await sql`
      SELECT
        p.id, p.workspace_id, p.source_kind, p.calendar_event_id, p.festival_key, p.event_name, p.event_date,
        p.post_title, p.caption, p.creative_svg, p.creative_preview_url, p.scheduled_for,
        p.posted_at, p.instagram_post_id, p.status, p.engagement_status, p.retry_count,
        p.failure_reason, p.disabled_reason, w.settings, u.subscription_tier
      FROM calendar_event_posts p
      JOIN workspaces w ON p.workspace_id = w.id
      JOIN users u ON w.owner_id = u.id
      WHERE p.status IN ('scheduled', 'failed')
        AND p.retry_count < 3
        AND (p.scheduled_for <= NOW() OR p.id = ${forcePostId || null})
      ORDER BY p.scheduled_for ASC
      LIMIT 100
    `;

    for (const post of dueCalendarPosts || []) {
      try {
        const branding = getBrandingSettings({ name: '', settings: post.settings });
        if (branding.calendarPostingPaused) {
          continue;
        }

        const tier = normalizePlanTier(post.subscription_tier);
        const postOrigin = publicOrigin;
        const imageUrl = String(post.creative_preview_url || buildCreativePreviewUrl(postOrigin, post.id));

        let publishedPostId: string;

        if (process.env.MOCK_INSTAGRAM === 'true') {
          publishedPostId = `IGP_MOCK_${Date.now()}`;
          console.log(`[CRON] MOCK POST: Bypassing actual Instagram API for post ${post.id}. Mock ID: ${publishedPostId}`);
        } else {
          publishedPostId = await publishInstagramImage(
            post.workspace_id,
            imageUrl,
            post.caption
          );
        }

        if (isDryRun) {
          console.log(`[CRON] DRY RUN: Would update calendar post ${post.id} status to 'posted' with IG ID ${publishedPostId}`);
        } else {
          await sql`
            UPDATE calendar_event_posts
            SET
              status = 'posted',
              posted_at = CURRENT_TIMESTAMP,
              instagram_post_id = ${publishedPostId},
              engagement_status = 'posted',
              failure_reason = NULL,
              retry_count = 0,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${post.id}
          `;
        }
      } catch (error) {
        const nextRetryCount = Number(post.retry_count || 0) + 1;

        if (isDryRun) {
          console.log(`[CRON] DRY RUN: Would mark calendar post ${post.id} as failed/retry (Attempt ${nextRetryCount}). Error: ${String(error)}`);
        } else {
          await sql`
            UPDATE calendar_event_posts
            SET
              status = ${nextRetryCount >= 3 ? 'failed' : post.status},
              retry_count = ${nextRetryCount},
              failure_reason = ${String(error)},
              engagement_status = 'failed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${post.id}
          `;
        }
        console.error('[CRON] Calendar post failed', {
          postId: post.id,
          workspaceId: post.workspace_id,
          sourceKind: post.source_kind,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedMessages.length,
      calendarSeeds: festivalSeeds.length,
      calendarPosts: dueCalendarPosts.length,
    });
  } catch (error) {
    console.error('[CRON ERROR]', error);

    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// ✅ Support BOTH methods
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

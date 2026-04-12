import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { v4 as uuidv4 } from 'uuid';

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

    console.log('[CRON] Processing scheduled messages...');

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
          await sql`
            UPDATE scheduled_messages
            SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${msg.id}
          `;
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
        if (shouldSendNow) {
          if (!isWithin24Hours) {
            console.log(`[CRON] Waiting (user inactive) ${msg.id}`);
            continue; // ⏳ wait, don’t skip
          }

          // 🚀 SEND MESSAGE
          const messageId = uuidv4();

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

          processedMessages.push({ id: msg.id, status: 'sent' });
          console.log(`[CRON] Sent ${msg.id}`);
        }
      } catch (error) {
        console.error(`[CRON] Error processing ${msg.id}`, error);

        await sql`
          UPDATE scheduled_messages
          SET status = 'error', error_message = ${String(error)}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${msg.id}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedMessages.length,
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
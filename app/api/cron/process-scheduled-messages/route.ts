import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { v4 as uuidv4 } from 'uuid';

// This endpoint is called by a cron job (Vercel Cron) every minute
// It processes scheduled messages and checks user activity before sending

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    // Verify this is a legitimate cron request (from Vercel)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[v0] Processing scheduled messages...');

    // Get all pending messages that are due to be sent (scheduled_at <= now)
    const messagesReady = await sql`
      SELECT 
        sm.id,
        sm.workspace_id,
        sm.customer_id,
        sm.phone,
        sm.message,
        sm.scheduled_at,
        c.last_user_message_at
      FROM scheduled_messages sm
      LEFT JOIN customers c ON sm.customer_id = c.id
      WHERE sm.status = 'pending' AND sm.scheduled_at <= CURRENT_TIMESTAMP
      ORDER BY sm.scheduled_at ASC
      LIMIT 100
    `;

    console.log(`[v0] Found ${messagesReady.length} messages to process`);

    const processedMessages = [];
    const now = new Date();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    for (const msg of messagesReady) {
      try {
        const lastUserMessageTime = msg.last_user_message_at ? new Date(msg.last_user_message_at) : null;
        const timeSinceLastMessage = lastUserMessageTime ? now.getTime() - lastUserMessageTime.getTime() : Infinity;
        
        // Check if customer has been active within the last 24 hours
        const isWithin24Hours = timeSinceLastMessage < twentyFourHoursMs;

        if (isWithin24Hours) {
          // Send the message
          const messageId = uuidv4();

          // Insert message into messages table as outbound
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

          // Update scheduled message status to 'sent'
          await sql`
            UPDATE scheduled_messages
            SET status = 'sent', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${msg.id}
          `;

          // Notify workspace via Pusher for real-time update
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
            console.error('[v0] Pusher notification error:', err);
          }

          processedMessages.push({ id: msg.id, status: 'sent', phone: msg.phone });
          console.log(`[v0] Sent scheduled message ${msg.id} to ${msg.phone}`);
        } else {
          // Customer not active within 24 hours - skip and mark as skipped
          await sql`
            UPDATE scheduled_messages
            SET status = 'skipped', error_message = 'Customer not active within 24 hours', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${msg.id}
          `;

          processedMessages.push({ id: msg.id, status: 'skipped', phone: msg.phone });
          console.log(`[v0] Skipped scheduled message ${msg.id} to ${msg.phone} (inactive customer)`);
        }
      } catch (error) {
        console.error(`[v0] Error processing message ${msg.id}:`, error);

        // Mark as error
        await sql`
          UPDATE scheduled_messages
          SET status = 'skipped', error_message = ${String(error)}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${msg.id}
        `;

        processedMessages.push({ id: msg.id, status: 'error', phone: msg.phone });
      }
    }

    // Clean up old messages (older than 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await sql`
      DELETE FROM scheduled_messages
      WHERE created_at < ${sevenDaysAgo.toISOString()} AND status IN ('sent', 'skipped', 'cancelled')
    `;

    return NextResponse.json({
      success: true,
      processed: processedMessages.length,
      details: processedMessages,
    });
  } catch (error) {
    console.error('[v0] Process scheduled messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

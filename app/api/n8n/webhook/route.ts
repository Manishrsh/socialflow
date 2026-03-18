import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { pusherServer } from '@/lib/pusher';
import { getPublicOrigin, normalizePublicUrl } from '@/lib/public-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const publicOrigin = getPublicOrigin(request);

    // Webhook signature verification (basic)
    const signature = request.headers.get('x-n8n-signature');
    // TODO: Implement proper signature verification

    console.log('[v0] n8n webhook received:', body);

    // Extract workflow execution data
    const {
      workflowId,
      customerId,
      customerPhone,
      message,
      messageType = 'text',
      mediaUrl,
      action,
      metadata,
    } = body;

    if (!customerId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get workspace_id for real-time events routing
    let workspaceId = body.workspaceId;
    if (!workspaceId) {
      try {
        const customerRes = await sql`SELECT workspace_id FROM customers WHERE id = ${customerId} LIMIT 1`;
        if (customerRes && customerRes.length > 0) {
          workspaceId = customerRes[0].workspace_id;
        }
      } catch (e) {
        console.error('Error fetching workspaceId:', e);
      }
    }

    // Log the message in database
    const messageId = uuidv4();
    const now = new Date();
    const normalizedMediaUrl = normalizePublicUrl(mediaUrl || null, publicOrigin);

    await sql`
      INSERT INTO messages (id, workspace_id, customer_id, workflow_id, direction, type, content, media_url, metadata, sent_at)
      VALUES (${messageId}, ${workspaceId || null}, ${customerId}, ${workflowId || null}, 'outbound', ${messageType}, ${message}, ${normalizedMediaUrl}, ${JSON.stringify(metadata || {})}, ${now})
    `;

    // Update customer last interaction
    await sql`
      UPDATE customers SET last_message_date = ${now} WHERE id = ${customerId}
    `;

    // Execute post-webhook actions
    if (action === 'save_contact') {
      // Update customer profile
      await sql`
        UPDATE customers SET name = COALESCE(${metadata?.name || null}, name), updated_at = ${now} WHERE id = ${customerId}
      `;
    }

    if (action === 'add_tag' && metadata?.tag) {
      // Add tag to customer
      await sql`
        UPDATE customers SET tags = array_append(tags, ${metadata.tag}), updated_at = ${now} WHERE id = ${customerId}
      `;
    }

    if (action === 'create_order' && metadata?.orderData) {
      // Create order record
      const orderId = uuidv4();
      await sql`
        INSERT INTO orders (id, customer_id, data, created_at) VALUES (${orderId}, ${customerId}, ${JSON.stringify(metadata.orderData)}, ${now})
      `;
    }

    // Trigger Real-time event for chatbox
    if (workspaceId) {
      try {
        await pusherServer.trigger(`workspace-${workspaceId}`, 'new-message', {
          id: messageId,
          customerId: customerId,
          phone: customerPhone || '',
          name: metadata?.name || null,
          source: metadata?.provider || 'whatsapp',
          content: message || '',
          mediaUrl: normalizedMediaUrl,
          direction: 'outbound',
          type: messageType || 'text',
          sentAt: now.toISOString(),
          readAt: null
        });
      } catch (pusherError) {
        console.error('Failed to trigger Pusher event:', pusherError);
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET for webhook verification (n8n health check)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'n8n webhook endpoint ready',
  });
}

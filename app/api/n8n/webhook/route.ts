import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    // Log the message in database
    const messageId = uuidv4();
    const now = new Date();

    await query(
      `INSERT INTO messages (id, customer_id, workflow_id, direction, message_type, content, media_url, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        messageId,
        customerId,
        workflowId || null,
        'outgoing',
        messageType,
        message,
        mediaUrl || null,
        JSON.stringify(metadata || {}),
        now,
      ]
    );

    // Update customer last interaction
    await query(
      `UPDATE customers SET last_message_date = $1 WHERE id = $2`,
      [now, customerId]
    );

    // Execute post-webhook actions
    if (action === 'save_contact') {
      // Update customer profile
      await query(
        `UPDATE customers SET name = COALESCE($1, name), updated_at = $2 WHERE id = $3`,
        [metadata?.name || null, now, customerId]
      );
    }

    if (action === 'add_tag' && metadata?.tag) {
      // Add tag to customer
      await query(
        `UPDATE customers SET tags = array_append(tags, $1), updated_at = $2 WHERE id = $3`,
        [metadata.tag, now, customerId]
      );
    }

    if (action === 'create_order' && metadata?.orderData) {
      // Create order record
      const orderId = uuidv4();
      await query(
        `INSERT INTO orders (id, customer_id, data, created_at) VALUES ($1, $2, $3, $4)`,
        [orderId, customerId, JSON.stringify(metadata.orderData), now]
      );
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

import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { customerId, message, scheduledAt } = await request.json();

    if (!customerId || !message || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate scheduled_at is within 24 hours
    const now = new Date();
    const scheduledDate = new Date(scheduledAt);
    const maxScheduleTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (scheduledDate < now) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    if (scheduledDate > maxScheduleTime) {
      return NextResponse.json({ error: 'Messages can only be scheduled within 24 hours' }, { status: 400 });
    }

    // Get customer and verify workspace ownership
    const customerResult = await sql`
      SELECT c.id, c.phone, c.workspace_id, w.owner_id
      FROM customers c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE c.id = ${customerId} AND w.owner_id = ${userId}
      LIMIT 1
    `;

    if (!customerResult || customerResult.length === 0) {
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    const customer = customerResult[0];
    const scheduledMessageId = uuidv4();

    // Insert scheduled message
    await sql`
      INSERT INTO scheduled_messages (
        id, workspace_id, customer_id, phone, message, scheduled_at, status, created_by, created_at, updated_at
      ) VALUES (
        ${scheduledMessageId},
        ${customer.workspace_id},
        ${customerId},
        ${customer.phone},
        ${message},
        ${new Date(scheduledAt).toISOString()},
        'pending',
        ${userId},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      id: scheduledMessageId,
      customerId,
      phone: customer.phone,
      message,
      scheduledAt: new Date(scheduledAt),
      status: 'pending',
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[v0] Schedule message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

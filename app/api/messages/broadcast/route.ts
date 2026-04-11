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

    const { workspaceId, message, delayHours = 0, delayMinutes = 0 } = await request.json();

    if (!workspaceId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId}
    `;

    if (!workspace || workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get all active customers
    const customers = await sql`
      SELECT id, phone FROM customers WHERE workspace_id = ${workspaceId} AND status = 'active'
    `;

    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        scheduled: 0,
        message: 'No active customers found' 
      });
    }

    // Calculate scheduled time
    const scheduledTime = new Date();
    scheduledTime.setHours(scheduledTime.getHours() + delayHours);
    scheduledTime.setMinutes(scheduledTime.getMinutes() + delayMinutes);

    // Schedule message for each customer
    const scheduledMessages = [];
    for (const customer of customers) {
      const messageId = uuidv4();
      
      await sql`
        INSERT INTO scheduled_messages (
          id, workspace_id, customer_id, phone, message, scheduled_at, status, schedule_mode, created_by
        ) VALUES (
          ${messageId},
          ${workspaceId},
          ${customer.id},
          ${customer.phone},
          ${message},
          ${scheduledTime.toISOString()},
          'pending',
          'fixed',
          ${userId}
        )
      `;

      scheduledMessages.push({
        id: messageId,
        customerId: customer.id,
        phone: customer.phone
      });
    }

    return NextResponse.json({
      success: true,
      scheduled: scheduledMessages.length,
      scheduledTime: scheduledTime.toISOString(),
      customers: scheduledMessages
    });
  } catch (error) {
    console.error('[v0] Broadcast error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

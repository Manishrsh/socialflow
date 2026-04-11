import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const { scheduledAt } = await request.json();

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
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

    // Get scheduled message and verify workspace ownership
    const message = await sql`
      SELECT sm.id, sm.workspace_id, sm.status, w.owner_id
      FROM scheduled_messages sm
      JOIN workspaces w ON sm.workspace_id = w.id
      WHERE sm.id = ${id} AND w.owner_id = ${userId}
      LIMIT 1
    `;

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    if (message[0].status !== 'pending') {
      return NextResponse.json({ error: 'Can only reschedule pending messages' }, { status: 400 });
    }

    // Update scheduled time
    await sql`
      UPDATE scheduled_messages
      SET scheduled_at = ${new Date(scheduledAt).toISOString()}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, message: 'Message rescheduled' });
  } catch (error) {
    console.error('[v0] Reschedule message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Get scheduled message and verify workspace ownership
    const message = await sql`
      SELECT sm.id, sm.workspace_id, w.owner_id
      FROM scheduled_messages sm
      JOIN workspaces w ON sm.workspace_id = w.id
      WHERE sm.id = ${id} AND w.owner_id = ${userId}
      LIMIT 1
    `;

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    // Mark as cancelled instead of deleting
    await sql`
      UPDATE scheduled_messages
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, message: 'Message cancelled' });
  } catch (error) {
    console.error('[v0] Delete message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

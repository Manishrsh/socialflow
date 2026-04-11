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
    const { enabled, messageTemplate, delayHours, delayMinutes } = await request.json();

    // Verify ownership
    const rule = await sql`
      SELECT r.* FROM auto_message_rules r
      JOIN workspaces w ON r.workspace_id = w.id
      WHERE r.id = ${id} AND w.owner_id = ${userId}
    `;

    if (!rule || rule.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await sql`
      UPDATE auto_message_rules 
      SET 
        enabled = ${enabled !== undefined ? enabled : rule[0].enabled},
        message_template = ${messageTemplate || rule[0].message_template},
        delay_hours = ${delayHours !== undefined ? delayHours : rule[0].delay_hours},
        delay_minutes = ${delayMinutes !== undefined ? delayMinutes : rule[0].delay_minutes},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const updated = await sql`SELECT * FROM auto_message_rules WHERE id = ${id}`;

    return NextResponse.json({
      success: true,
      rule: updated[0]
    });
  } catch (error) {
    console.error('[v0] Update rule error:', error);
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

    // Verify ownership
    const rule = await sql`
      SELECT r.* FROM auto_message_rules r
      JOIN workspaces w ON r.workspace_id = w.id
      WHERE r.id = ${id} AND w.owner_id = ${userId}
    `;

    if (!rule || rule.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await sql`DELETE FROM auto_message_rules WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Delete rule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

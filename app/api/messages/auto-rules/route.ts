import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const rules = await sql`
      SELECT * FROM auto_message_rules 
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('[v0] Get auto rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const { workspaceId, ruleType, messageTemplate, delayHours = 0, delayMinutes = 0 } = await request.json();

    if (!workspaceId || !ruleType || !messageTemplate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId}
    `;

    if (!workspace || workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const ruleId = uuidv4();

    await sql`
      INSERT INTO auto_message_rules (
        id, workspace_id, rule_type, message_template, delay_hours, delay_minutes, created_by
      ) VALUES (
        ${ruleId},
        ${workspaceId},
        ${ruleType},
        ${messageTemplate},
        ${delayHours},
        ${delayMinutes},
        ${userId}
      )
    `;

    const rule = await sql`
      SELECT * FROM auto_message_rules WHERE id = ${ruleId}
    `;

    return NextResponse.json({
      success: true,
      rule: rule[0]
    });
  } catch (error) {
    console.error('[v0] Create auto rule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

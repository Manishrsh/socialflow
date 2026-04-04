import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const alerts = await sql`
      SELECT
        id,
        alert_type,
        severity,
        message,
        is_active,
        threshold_value,
        triggered_count,
        last_triggered_at,
        created_at,
        updated_at
      FROM analytics_alerts
      WHERE workspace_id = ${workspaceId}
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({
      alerts: alerts.map((a: any) => ({
        id: a.id,
        type: a.alert_type,
        severity: a.severity,
        message: a.message,
        is_active: a.is_active,
        threshold: a.threshold_value,
        triggered_count: a.triggered_count,
        last_triggered: a.last_triggered_at,
        created_at: a.created_at,
        updated_at: a.updated_at,
      })),
      summary: {
        total_alerts: alerts.length,
        active_alerts: alerts.filter((a: any) => a.is_active).length,
        high_severity: alerts.filter((a: any) => a.severity === 'high').length,
        medium_severity: alerts.filter((a: any) => a.severity === 'medium').length,
        low_severity: alerts.filter((a: any) => a.severity === 'low').length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Alerts config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, type, severity, message, threshold_value } = body;

    if (!workspaceId || !type || !severity) {
      return NextResponse.json(
        { error: 'workspaceId, type, and severity are required' },
        { status: 400 }
      );
    }

    const validSeverities = ['high', 'medium', 'low'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const alertId = uuidv4();
    await sql`
      INSERT INTO analytics_alerts (id, workspace_id, alert_type, severity, message, threshold_value, is_active)
      VALUES (${alertId}, ${workspaceId}, ${type}, ${severity}, ${message || ''}, ${threshold_value || null}, true)
    `;

    return NextResponse.json({
      id: alertId,
      type,
      severity,
      message,
      threshold: threshold_value,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Alerts config POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { alertId, is_active, threshold_value, severity } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
    }

    await sql`
      UPDATE analytics_alerts
      SET
        is_active = COALESCE(${is_active}, is_active),
        threshold_value = COALESCE(${threshold_value}, threshold_value),
        severity = COALESCE(${severity}, severity),
        updated_at = NOW()
      WHERE id = ${alertId}
    `;

    return NextResponse.json({
      success: true,
      alertId,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Alerts config PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

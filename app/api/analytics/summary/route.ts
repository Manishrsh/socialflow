import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';

function formatDayLabel(value: string | Date) {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
    const days = Math.max(1, Math.min(365, Number(searchParams.get('days') || searchParams.get('period') || 30)));

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const owned = await sql`
      SELECT id, name
      FROM workspaces
      WHERE id = ${workspaceId} AND owner_id = ${userId}
      LIMIT 1
    `;

    if (!owned || owned.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      customersRows,
      messagesRows,
      activeWorkflowRows,
      webhookRows,
      executionRows,
      outboxRows,
      trendRows,
      messageTypeRows,
      outboxStatusRows,
      topWorkflowRows,
      peakHourRows,
      channelRows,
    ] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS count
        FROM customers
        WHERE workspace_id = ${workspaceId}
      `,
      sql`
        SELECT
          COUNT(*)::int AS total_messages,
          COUNT(*) FILTER (WHERE direction = 'incoming')::int AS incoming_messages,
          COUNT(*) FILTER (WHERE direction = 'outgoing')::int AS outgoing_messages,
          COUNT(DISTINCT customer_id)::int AS active_customers
        FROM messages
        WHERE workspace_id = ${workspaceId} AND sent_at >= ${startDate}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM workflows
        WHERE workspace_id = ${workspaceId} AND is_active = true
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM webhook_events
        WHERE workspace_id = ${workspaceId} AND received_at >= ${startDate}
      `,
      sql`
        SELECT
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_runs,
          COUNT(*) FILTER (WHERE trigger_source = 'webhook')::int AS webhook_runs
        FROM workflow_execution_logs
        WHERE workspace_id = ${workspaceId} AND created_at >= ${startDate}
      `,
      sql`
        SELECT
          COUNT(*)::int AS total_outbox,
          COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'success'))::int AS sent_outbox
        FROM own_bsp_outbox
        WHERE workspace_id = ${workspaceId} AND created_at >= ${startDate}
      `,
      sql`
        SELECT
          DATE(sent_at) AS day,
          COUNT(*)::int AS messages,
          COUNT(*) FILTER (WHERE direction = 'incoming')::int AS inbound
        FROM messages
        WHERE workspace_id = ${workspaceId} AND sent_at >= ${startDate}
        GROUP BY DATE(sent_at)
        ORDER BY day ASC
      `,
      sql`
        SELECT
          COALESCE(type, 'text') AS type,
          COUNT(*)::int AS count
        FROM messages
        WHERE workspace_id = ${workspaceId} AND sent_at >= ${startDate}
        GROUP BY COALESCE(type, 'text')
        ORDER BY count DESC
      `,
      sql`
        SELECT
          COALESCE(status, 'unknown') AS status,
          COUNT(*)::int AS count
        FROM own_bsp_outbox
        WHERE workspace_id = ${workspaceId} AND created_at >= ${startDate}
        GROUP BY COALESCE(status, 'unknown')
        ORDER BY count DESC
      `,
      sql`
        SELECT
          l.workflow_id,
          w.name,
          COUNT(*)::int AS runs,
          COUNT(*) FILTER (WHERE l.status = 'completed')::int AS completed_runs
        FROM workflow_execution_logs l
        INNER JOIN workflows w ON l.workflow_id = w.id
        WHERE l.workspace_id = ${workspaceId} AND l.created_at >= ${startDate}
        GROUP BY l.workflow_id, w.name
        ORDER BY runs DESC, w.name ASC
        LIMIT 5
      `,
      sql`
        SELECT
          EXTRACT(HOUR FROM sent_at)::int AS hour,
          COUNT(*)::int AS count
        FROM messages
        WHERE workspace_id = ${workspaceId} AND sent_at >= ${startDate}
        GROUP BY EXTRACT(HOUR FROM sent_at)
        ORDER BY count DESC, hour ASC
        LIMIT 1
      `,
      sql`
        SELECT
          COALESCE(metadata->>'provider', 'unknown') AS source,
          COUNT(*)::int AS count
        FROM customers
        WHERE workspace_id = ${workspaceId}
        GROUP BY COALESCE(metadata->>'provider', 'unknown')
        ORDER BY count DESC
      `,
    ]);

    const totalCustomers = Number(customersRows?.[0]?.count || 0);
    const totalMessages = Number(messagesRows?.[0]?.total_messages || 0);
    const incomingMessages = Number(messagesRows?.[0]?.incoming_messages || 0);
    const outgoingMessages = Number(messagesRows?.[0]?.outgoing_messages || 0);
    const activeCustomers = Number(messagesRows?.[0]?.active_customers || 0);
    const activeWorkflows = Number(activeWorkflowRows?.[0]?.count || 0);
    const webhookEvents = Number(webhookRows?.[0]?.count || 0);
    const totalRuns = Number(executionRows?.[0]?.total_runs || 0);
    const completedRuns = Number(executionRows?.[0]?.completed_runs || 0);
    const failedRuns = Number(executionRows?.[0]?.failed_runs || 0);
    const webhookRuns = Number(executionRows?.[0]?.webhook_runs || 0);
    const totalOutbox = Number(outboxRows?.[0]?.total_outbox || 0);
    const sentOutbox = Number(outboxRows?.[0]?.sent_outbox || 0);

    const engagementRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;
    const workflowSuccessRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
    const deliveryRate = totalOutbox > 0 ? Math.round((sentOutbox / totalOutbox) * 100) : 0;
    const avgMessagesPerCustomer = totalCustomers > 0 ? Number((totalMessages / totalCustomers).toFixed(1)) : 0;
    const peakHour = peakHourRows?.[0]?.hour;

    return NextResponse.json({
      summary: {
        workspaceName: owned[0].name,
        totalCustomers,
        totalMessages,
        incomingMessages,
        outgoingMessages,
        activeCustomers,
        activeWorkflows,
        webhookEvents,
        totalRuns,
        completedRuns,
        failedRuns,
        webhookRuns,
        engagementRate,
        workflowSuccessRate,
        deliveryRate,
        avgMessagesPerCustomer,
        period,
        peakHour: peakHour === undefined || peakHour === null ? null : `${String(peakHour).padStart(2, '0')}:00`,
      },
      trend: trendRows.map((row: any) => ({
        date: formatDayLabel(row.day),
        messages: Number(row.messages || 0),
        inbound: Number(row.inbound || 0),
      })),
      messageTypes: messageTypeRows.map((row: any) => ({
        type: row.type || 'text',
        count: Number(row.count || 0),
      })),
      outboxStatuses: outboxStatusRows.map((row: any) => ({
        status: row.status || 'unknown',
        count: Number(row.count || 0),
      })),
      topWorkflows: topWorkflowRows.map((row: any) => ({
        workflowId: row.workflow_id,
        name: row.name,
        runs: Number(row.runs || 0),
        completedRuns: Number(row.completed_runs || 0),
      })),
      channels: channelRows.map((row: any) => ({
        source: row.source || 'unknown',
        count: Number(row.count || 0),
      })),
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

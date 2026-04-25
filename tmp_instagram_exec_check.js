const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const workflowId = '8513037d-0a68-4c38-978a-5dbe25e9e22f';

  const workflow = await sql`
    SELECT id, workspace_id, name, is_active, updated_at
    FROM workflows
    WHERE id = ${workflowId}
    LIMIT 1
  `;

  const instagramEvents = await sql`
    SELECT id, provider, event_type, received_at
    FROM webhook_events
    WHERE workspace_id = ${workflow[0]?.workspace_id || ''}
      AND provider = 'instagram'
    ORDER BY received_at DESC
    LIMIT 5
  `;

  const recentExecutionStats = await sql`
    SELECT
      COUNT(*)::int AS count,
      MAX(created_at) AS latest
    FROM workflow_execution_logs
    WHERE workflow_id = ${workflowId}
      AND created_at >= NOW() - INTERVAL '30 minutes'
  `;

  const recentExecutionLogs = await sql`
    SELECT id, status, executed_nodes, summary, created_at
    FROM workflow_execution_logs
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
    LIMIT 8
  `;

  const recentOutbox = await sql`
    SELECT id, channel, status, recipient, message_type, created_at, error
    FROM own_bsp_outbox
    WHERE workspace_id = ${workflow[0]?.workspace_id || ''}
    ORDER BY created_at DESC
    LIMIT 8
  `;

  console.log(JSON.stringify({
    workflow: workflow[0] || null,
    instagramEvents,
    recentExecutionStats: recentExecutionStats[0] || null,
    recentExecutionLogs,
    recentOutbox,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

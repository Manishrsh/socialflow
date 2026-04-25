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

  const igEvents = await sql`
    SELECT id, workspace_id, provider, event_type, received_at, payload
    FROM webhook_events
    WHERE workspace_id = ${workflow[0]?.workspace_id || ''}
      AND provider = 'instagram'
    ORDER BY received_at DESC
    LIMIT 20
  `;

  const recentEvents = await sql`
    SELECT id, workspace_id, provider, event_type, received_at, payload
    FROM webhook_events
    WHERE workspace_id = ${workflow[0]?.workspace_id || ''}
    ORDER BY received_at DESC
    LIMIT 20
  `;

  const logs = await sql`
    SELECT id, workspace_id, workflow_id, phone, trigger_source, status, executed_nodes, summary, details, created_at, updated_at
    FROM workflow_execution_logs
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const waits = await sql`
    SELECT id, workspace_id, workflow_id, node_id, phone, created_at, expires_at
    FROM workflow_wait_states
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  console.log(JSON.stringify({
    workflow: workflow[0] || null,
    instagramEvents: igEvents,
    recentEvents,
    executionLogs: logs,
    waitStates: waits,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

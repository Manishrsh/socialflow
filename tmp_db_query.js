const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const workflowId = '8513037d-0a68-4c38-978a-5dbe25e9e22f';

  const counts = await sql`
    SELECT provider, event_type, COUNT(*)::int AS count
    FROM webhook_events
    GROUP BY provider, event_type
    ORDER BY count DESC, provider, event_type
  `;

  const recent = await sql`
    SELECT id, workspace_id, provider, event_type, received_at, payload
    FROM webhook_events
    ORDER BY received_at DESC
    LIMIT 10
  `;

  const dedup = await sql`
    SELECT workspace_id, provider, external_message_id, event_type, COUNT(*)::int AS count
    FROM inbound_event_dedup
    GROUP BY workspace_id, provider, external_message_id, event_type
    ORDER BY count DESC
    LIMIT 10
  `;

  const wf = await sql`
    SELECT id, workspace_id, name, is_active
    FROM workflows
    WHERE id = ${workflowId}
    LIMIT 1
  `;

  console.log(JSON.stringify({
    workflow: wf[0] || null,
    counts,
    recent,
    dedup,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

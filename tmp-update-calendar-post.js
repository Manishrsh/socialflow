const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const envFile = '.env';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!key) continue;
    const value = rest.join('=').trim();
    if (value && !process.env[key]) {
      process.env[key] = value.replace(/^['\"]|['\"]$/g, '');
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}
const sql = neon(url);
const postId = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';
(async () => {
  try {
    const rows = await sql`UPDATE calendar_event_posts SET scheduled_for = NOW(), status = 'scheduled', retry_count = 0, updated_at = NOW() WHERE id = ${postId} RETURNING id, calendar_event_id, event_name, event_date, status, scheduled_for, retry_count, updated_at`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

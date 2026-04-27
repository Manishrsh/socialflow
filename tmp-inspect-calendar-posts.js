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
(async () => {
  try {
    const rows = await sql`SELECT id, calendar_event_id, event_name, event_date, status, scheduled_for, created_at FROM calendar_event_posts WHERE workspace_id = ${'d82a2ec7-abdf-4e5d-a54d-cae316164631'} ORDER BY created_at DESC LIMIT 10`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

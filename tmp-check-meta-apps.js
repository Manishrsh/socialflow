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
    const rows = await sql`SELECT id, workspace_id, name, app_id, instagram_business_account_id, instagram_access_token, is_default, created_at FROM meta_apps WHERE workspace_id = ${'d82a2ec7-abdf-4e5d-a54d-cae316164631'} ORDER BY is_default DESC, created_at ASC LIMIT 5`;
    console.log('Meta Apps for workspace:');
    console.log(JSON.stringify(rows, null, 2));
    console.log('\nEnv vars:');
    console.log('INSTAGRAM_BUSINESS_ACCOUNT_ID:', process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
    console.log('INSTAGRAM_ACCESS_TOKEN:', process.env.INSTAGRAM_ACCESS_TOKEN ? 'Set (length: ' + process.env.INSTAGRAM_ACCESS_TOKEN.length + ')' : 'Not set');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

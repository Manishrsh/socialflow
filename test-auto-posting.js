#!/usr/bin/env node

/**
 * Test script for auto posting with your uploaded media
 * Usage: node test-auto-posting.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TEST_DATA = {
  mediaId: '2dbf3957-7b5e-40b9-ad9d-415e17b9fad8',
  mediaUrl:
    'https://socialflows.vercel.app/api/media/2dbf3957-7b5e-40b9-ad9d-415e17b9fad8/content',
  workspaceId: 'test-workspace-001',
  userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(color, label, message) {
  console.log(`${COLORS[color]}[${label}]${COLORS.reset} ${message}`);
}

function testMediaUrl() {
  return new Promise((resolve) => {
    log('blue', 'TEST', 'Checking media URL accessibility...');

    https
      .get(TEST_DATA.mediaUrl, (res) => {
        if (res.statusCode === 200) {
          log('green', 'PASS', `Media URL is accessible (${res.headers['content-type']})`);
          log('gray', 'INFO', `Size: ${res.headers['content-length']} bytes`);
          resolve(true);
        } else {
          log('red', 'FAIL', `Media URL returned ${res.statusCode}`);
          resolve(false);
        }
        res.resume();
      })
      .on('error', (err) => {
        log('red', 'FAIL', `Cannot access media URL: ${err.message}`);
        resolve(false);
      });
  });
}

async function testCronEndpoint() {
  return new Promise((resolve) => {
    log('blue', 'TEST', 'Testing cron endpoint...');

    http
      .get('http://localhost:3000/api/cron/process-scheduled-messages', (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success === false) {
              log('yellow', 'WARN', 'Cron endpoint not running (development server needed)');
              resolve(false);
            } else {
              log('green', 'PASS', `Cron responded: processed=${json.processed}, posts=${json.calendarPosts}`);
              resolve(true);
            }
          } catch {
            log('yellow', 'WARN', 'Could not parse cron response (server may not be running)');
            resolve(false);
          }
        });
      })
      .on('error', (err) => {
        log('yellow', 'WARN', `Cron endpoint not accessible: ${err.message} (start dev server first)`);
        resolve(false);
      });
  });
}

function printSQLCommands() {
  log('blue', 'SETUP', 'SQL Commands to run:');
  console.log(`
${COLORS.gray}-- 1. Create test user${COLORS.reset}
INSERT INTO users (id, email, name, company_name, role, subscription_tier, subscription_status)
VALUES (
  '${TEST_DATA.userId}',
  'test@example.com',
  'Test User',
  'Test Company',
  'owner',
  'pro',
  'active'
) ON CONFLICT DO NOTHING;

${COLORS.gray}-- 2. Create workspace${COLORS.reset}
INSERT INTO workspaces (owner_id, name, slug, settings)
VALUES (
  '${TEST_DATA.userId}',
  'Test Workspace',
  '${TEST_DATA.workspaceId}',
  '{"calendarPostingPaused": false}'::jsonb
) ON CONFLICT DO NOTHING;

${COLORS.gray}-- 3. Create calendar event with your media${COLORS.reset}
INSERT INTO calendar_events (workspace_id, name, event_date, event_type, repeat_yearly, is_enabled, logo_url, created_by)
VALUES (
  '${TEST_DATA.workspaceId}',
  'Test Sale Event',
  CURRENT_DATE,
  'Sale',
  false,
  true,
  '${TEST_DATA.mediaUrl}',
  '${TEST_DATA.userId}'
);

${COLORS.gray}-- 4. Add Instagram credentials${COLORS.reset}
INSERT INTO meta_apps (workspace_id, name, app_id, instagram_business_account_id, instagram_access_token)
VALUES (
  '${TEST_DATA.workspaceId}',
  'Test Meta App',
  'test-app-id',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'YOUR_INSTAGRAM_ACCESS_TOKEN'
);

${COLORS.gray}-- 5. Check posted results${COLORS.reset}
SELECT status, posted_at, instagram_post_id, failure_reason
FROM calendar_event_posts
WHERE workspace_id = '${TEST_DATA.workspaceId}'
ORDER BY created_at DESC;
  `);
}

function printPowerShellCommand() {
  log('blue', 'TEST', 'PowerShell command to trigger cron:');
  console.log(`
${COLORS.gray}$response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-scheduled-messages" \`${COLORS.reset}
${COLORS.gray}  -UseBasicParsing${COLORS.reset}

${COLORS.gray}$response.Content | ConvertFrom-Json | ConvertTo-Json${COLORS.reset}
  `);
}

function printEnvTemplate() {
  log('blue', 'CONFIG', '.env.local template:');
  console.log(`
${COLORS.gray}DATABASE_URL=your-neon-connection-string${COLORS.reset}
${COLORS.gray}INSTAGRAM_BUSINESS_ACCOUNT_ID=your-ig-account-id${COLORS.reset}
${COLORS.gray}INSTAGRAM_ACCESS_TOKEN=your-access-token${COLORS.reset}
${COLORS.gray}INSTAGRAM_GRAPH_API_VERSION=v23.0${COLORS.reset}
${COLORS.gray}NEXT_PUBLIC_BASE_URL=http://localhost:3000${COLORS.reset}
  `);
}

async function main() {
  console.log(`
${COLORS.blue}╔════════════════════════════════════════════╗${COLORS.reset}
${COLORS.blue}║   Auto Posting Test - Media Upload Ready   ║${COLORS.reset}
${COLORS.blue}╚════════════════════════════════════════════╝${COLORS.reset}
  `);

  log('yellow', 'INFO', `Media ID: ${TEST_DATA.mediaId}`);
  log('yellow', 'INFO', `Workspace: ${TEST_DATA.workspaceId}`);

  console.log('');

  // Run tests
  const mediaUrlOk = await testMediaUrl();
  const cronOk = await testCronEndpoint();

  console.log('');

  if (mediaUrlOk && cronOk) {
    log('green', 'READY', 'All systems ready! Proceed to setup.');
  } else if (mediaUrlOk) {
    log('yellow', 'PARTIAL', 'Media is ready. Start dev server with: pnpm dev');
  } else {
    log('red', 'ERROR', 'Media URL is not accessible. Check upload.');
  }

  console.log('');
  printSQLCommands();
  console.log('');
  printPowerShellCommand();
  console.log('');
  printEnvTemplate();

  console.log(`
${COLORS.blue}Next Steps:${COLORS.reset}
1. Set up .env.local with Instagram credentials
2. Run SQL commands above (copy into Neon console)
3. Start dev server: ${COLORS.yellow}pnpm dev${COLORS.reset}
4. Trigger cron with PowerShell command above
5. Check DB for posted_at timestamp
  `);
}

main().catch(console.error);

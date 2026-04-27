# Local Testing Guide - Auto Posting Feature

## Quick Start

You've successfully hit the cron endpoint! It returns 0 items because there's no test data. Follow this guide to test auto posting end-to-end.

## Step 1: Create Test User & Workspace

### Via Database (Fastest)

```bash
# Connect to your Neon database
psql "your-connection-string"
```

```sql
-- 1. Create test user
INSERT INTO users (id, email, name, company_name, role, subscription_tier, subscription_status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'test@example.com',
  'Test User',
  'Test Company',
  'owner',
  'pro',
  'active'
);

-- 2. Create workspace for that user
INSERT INTO workspaces (owner_id, name, slug, settings)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Test Workspace',
  'test-workspace',
  '{"calendarPostingPaused": false}'::jsonb
);

-- Get the workspace ID
SELECT id FROM workspaces WHERE slug = 'test-workspace';
```

## Step 2: Create Test Calendar Event

Replace `WORKSPACE_ID` with the ID from Step 1:

```sql
-- Create a calendar event for today
INSERT INTO calendar_events (
  workspace_id,
  name,
  event_date,
  event_type,
  repeat_yearly,
  is_enabled,
  created_by
)
VALUES (
  'WORKSPACE_ID',
  'Test Sale Event',
  CURRENT_DATE,
  'Sale',
  false,
  true,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);
```

## Step 3: Set Instagram Credentials

Add your Instagram business account credentials to the database:

```sql
INSERT INTO meta_apps (
  workspace_id,
  name,
  app_id,
  instagram_business_account_id,
  instagram_access_token
)
VALUES (
  'WORKSPACE_ID',
  'Test Meta App',
  'test-app-id',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'YOUR_INSTAGRAM_ACCESS_TOKEN'
);
```

### Getting Instagram Credentials:
1. Go to [Meta Developers](https://developers.facebook.com)
2. Create an app with Instagram Graph API
3. Get your Business Account ID from the app dashboard
4. Generate a long-lived access token (valid for ~60 days)
5. Test with `GET /me` to verify token works

## Step 4: Set Environment Variables

In `.env.local`:

```env
DATABASE_URL=your-neon-connection-string
INSTAGRAM_BUSINESS_ACCOUNT_ID=fallback-account-id
INSTAGRAM_ACCESS_TOKEN=fallback-token
INSTAGRAM_GRAPH_API_VERSION=v23.0
```

## Step 5: Run Dev Server

```bash
pnpm dev
```

## Step 6: Trigger the Cron (Multiple Ways)

### Option A: PowerShell (without prompt)
```powershell
$headers = @{
  "Content-Type" = "application/json"
}
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-scheduled-messages" `
  -Method POST `
  -Headers $headers `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### Option B: curl
```bash
curl -X GET "http://localhost:3000/api/cron/process-scheduled-messages"
```

### Option C: Open in Browser
```
http://localhost:3000/api/cron/process-scheduled-messages
```

## Step 7: Check Results

### View Created Posts
```sql
SELECT 
  id,
  status,
  scheduled_for,
  posted_at,
  failure_reason,
  instagram_post_id,
  engagement_status
FROM calendar_event_posts
WHERE workspace_id = 'WORKSPACE_ID'
ORDER BY created_at DESC;
```

### Expected Response (First Run)
```json
{
  "success": true,
  "processed": 0,
  "calendarSeeds": 1,      // Festival auto-created
  "calendarPosts": 0       // Not yet posted
}
```

### Expected Response (Second Run)
```json
{
  "success": true,
  "processed": 0,
  "calendarSeeds": 0,
  "calendarPosts": 1       // Post published to Instagram!
}
```

## Testing Different Scenarios

### Scenario 1: Festival Auto-Posting (Daily)
The cron auto-creates posts for today's festivals if:
- Workspace subscription tier is `pro` or higher
- `calendarPostingPaused` is `false`
- No post exists yet for today's festival

Run the cron on the date of a festival (check `CALENDAR_FESTIVALS` in `lib/calendar-marketing.ts`).

### Scenario 2: Custom Calendar Events
Create your own event and schedule it:

```sql
INSERT INTO calendar_events (
  workspace_id,
  name,
  event_date,
  event_type,
  is_enabled
) VALUES (
  'WORKSPACE_ID',
  'Black Friday',
  '2025-11-28',
  'Sale',
  true
);
```

The cron will find the matching date and post.

### Scenario 3: Retry on Failure
Set `scheduled_for` to the past to force reprocessing:

```sql
UPDATE calendar_event_posts
SET scheduled_for = NOW() - INTERVAL '1 hour'
WHERE id = 'POST_ID';
```

## Debugging Failed Posts

### Check Error Messages
```sql
SELECT 
  id,
  failure_reason,
  retry_count,
  status
FROM calendar_event_posts
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Common Errors:
- **Invalid Instagram Token**: Check token expiry and permissions
- **Missing Business Account ID**: Verify meta_apps record exists
- **Rate Limited**: Wait before retrying
- **Bad Image URL**: Verify `creative_preview_url` is accessible

### Mock Testing Without Instagram

Edit `app/api/cron/process-scheduled-messages/route.ts`:

```typescript
// Add before calling Instagram API (around line 285):
if (process.env.MOCK_INSTAGRAM === 'true') {
  const mockPostId = `IGP_${Date.now()}`;
  
  await sql`
    UPDATE calendar_event_posts
    SET
      status = 'posted',
      posted_at = CURRENT_TIMESTAMP,
      instagram_post_id = ${mockPostId},
      engagement_status = 'posted'
    WHERE id = ${post.id}
  `;
  
  console.log('[CRON] MOCK: Posted', mockPostId);
  continue;
}
```

Then set in `.env.local`:
```env
MOCK_INSTAGRAM=true
```

## Logs to Watch

Check browser console and server logs:

```
[CRON] HIT
[CRON] Processing scheduled messages...
[CRON] Creating Instagram media container: {imageUrl, caption}
[CRON] Publishing Instagram media: {creationId}
[CRON] Scheduled calendar post update...
```

## Files to Know

- [Cron handler](app/api/cron/process-scheduled-messages/route.ts) - Main execution
- [Calendar service](lib/calendar-marketing.ts) - Event building & creativity
- [Instagram publisher](lib/instagram-publishing-service.ts) - Meta Graph API calls
- [Database schema](lib/db.ts) - Tables structure

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `{"processed":0,"calendarSeeds":0}` | No calendar events for today. Create one in Step 2. |
| Instagram token keeps expiring | Generate long-lived token (60 days). Refresh before expiry. |
| `scheduled_for` is in past | Cron only processes posts with `scheduled_for <= NOW()` |
| Status stuck on `scheduled` | Check retry_count < 3 and Instagram errors in `failure_reason` |
| No `instagram_post_id` | Token invalid or API call failed. Check logs. |


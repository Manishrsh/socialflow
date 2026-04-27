# Test Instagram Posting - Update & Post One Row

## Your Workspace & Post Details
- **Workspace ID**: `d82a2ec7-abdf-4e5d-a54d-cae316164631`
- **Post ID to test**: `9071b0cb-9549-4fc7-a000-b92eb4eb1154` (anniversaryshop event)
- **Current status**: `scheduled` for 2027-04-27 (future)
- **Media URL**: `https://socialflows.vercel.app/api/media/90b4bf9c-9a11-4069-a0ed-032ed102c40a/content`

## Step 1: Update the Post to Schedule It Now

Run this SQL in your Neon database console:

```sql
-- Update the post to be scheduled for NOW (so cron will process it immediately)
UPDATE calendar_event_posts
SET scheduled_for = NOW()
WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';
```

## Step 2: Verify the Update

Check the post status:

```sql
SELECT id, status, scheduled_for, posted_at, instagram_post_id, failure_reason, engagement_status
FROM calendar_event_posts
WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';
```

**Expected result**:
- `scheduled_for` should be current timestamp (not 2027)
- `status` should still be `scheduled`

## Step 3: Ensure Instagram Credentials

Verify you have Instagram credentials in your workspace:

```sql
SELECT instagram_business_account_id, instagram_access_token
FROM meta_apps
WHERE workspace_id = 'd82a2ec7-abdf-4e5d-a54d-cae316164631'
ORDER BY is_default DESC, created_at ASC
LIMIT 1;
```

If no results, add credentials:

```sql
INSERT INTO meta_apps (
  workspace_id,
  name,
  app_id,
  instagram_business_account_id,
  instagram_access_token
)
VALUES (
  'd82a2ec7-abdf-4e5d-a54d-cae316164631',
  'Instagram Test App',
  'test-app-id',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'YOUR_INSTAGRAM_ACCESS_TOKEN'
);
```

## Step 4: Start Local Dev Server

```bash
pnpm dev
```

## Step 5: Trigger the Cron Process

**PowerShell** (recommended):
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-scheduled-messages" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected response**:
```json
{
  "success": true,
  "processed": 0,
  "calendarSeeds": 0,
  "calendarPosts": 1
}
```

## Step 6: Check the Result

Run this SQL to see if it posted:

```sql
SELECT id, status, scheduled_for, posted_at, instagram_post_id, failure_reason, engagement_status
FROM calendar_event_posts
WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';
```

**Success indicators**:
- `status = 'posted'`
- `posted_at` is set (not null)
- `instagram_post_id` is set (not null)
- `engagement_status = 'posted'`

**Failure indicators**:
- `status = 'failed'`
- `failure_reason` contains error message
- `retry_count` increased

## Step 7: Check Your Instagram Account

If successful, the post should appear in your Instagram feed with:
- The image from: `https://socialflows.vercel.app/api/media/90b4bf9c-9a11-4069-a0ed-032ed102c40a/content`
- Caption: "1st Anniversary\nCelebrating with MANISH RAJU SHINDE's Workspace"

## Troubleshooting

### If `calendarPosts: 0`
- The post might not be due yet. Check `scheduled_for` timestamp.
- Force it: `UPDATE calendar_event_posts SET scheduled_for = NOW() - INTERVAL '1 minute' WHERE id = '...';`

### If status stays `scheduled`
- No Instagram credentials found. Check Step 3.
- Cron didn't run. Check server logs for errors.

### If status becomes `failed`
- Check `failure_reason` column for details.
- Common issues:
  - Invalid Instagram token
  - Wrong business account ID
  - Image URL not accessible by Instagram
  - API rate limits

## Alternative: Test with JPEG Media

If the current media fails, try updating to use the JPEG URL you provided:

```sql
UPDATE calendar_event_posts
SET creative_preview_url = 'https://api.scalesoft.in/api/media/905a3aec-d956-448b-b823-5410ae7d3eb4/content'
WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';
```

## Quick Test Commands

```bash
# 1. Update post timing
psql "your-database-url" -c "UPDATE calendar_event_posts SET scheduled_for = NOW() WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';"

# 2. Check status
psql "your-database-url" -c "SELECT status, scheduled_for, posted_at, instagram_post_id FROM calendar_event_posts WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';"

# 3. Run cron
curl http://localhost:3000/api/cron/process-scheduled-messages

# 4. Check result again
psql "your-database-url" -c "SELECT status, posted_at, instagram_post_id, failure_reason FROM calendar_event_posts WHERE id = '9071b0cb-9549-4fc7-a000-b92eb4eb1154';"
```


# Test Auto Posting with Your Uploaded Media

Your media file is ready. Here's how to test auto posting with it:

## Media Details
- **Media ID**: `2dbf3957-7b5e-40b9-ad9d-415e17b9fad8`
- **File**: business-logo-template-minimal-branding-design-vector_53876-136229.avif
- **URL**: `https://socialflows.vercel.app/api/media/2dbf3957-7b5e-40b9-ad9d-415e17b9fad8/content`
- **Size**: 7.4 KB

## Quick Test Steps

### Step 1: Add Test Data to Database

```sql
-- 1. Create test user (if not exists)
INSERT INTO users (id, email, name, company_name, role, subscription_tier, subscription_status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'test@example.com',
  'Test User',
  'Test Company',
  'owner',
  'pro',
  'active'
) ON CONFLICT DO NOTHING;

-- 2. Create test workspace (if not exists)
INSERT INTO workspaces (owner_id, name, slug, settings)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Test Workspace',
  'test-workspace',
  '{"calendarPostingPaused": false, "businessName": "Your Business", "industry": "retail"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Get workspace ID for next steps
SELECT id as workspace_id FROM workspaces WHERE slug = 'test-workspace' LIMIT 1;
```

### Step 2: Store Media Reference

```sql
-- Save the media reference
INSERT INTO media (workspace_id, type, url, name, size_bytes, mime_type, metadata)
VALUES (
  'WORKSPACE_ID_FROM_STEP1',
  'image',
  'https://socialflows.vercel.app/api/media/2dbf3957-7b5e-40b9-ad9d-415e17b9fad8/content',
  'business-logo-template-minimal-branding-design-vector_53876-136229.avif',
  7411,
  'image/avif',
  '{"mediaId": "2dbf3957-7b5e-40b9-ad9d-415e17b9fad8"}'::jsonb
);
```

### Step 3: Create Calendar Event with Logo

```sql
INSERT INTO calendar_events (
  workspace_id,
  name,
  event_date,
  event_type,
  repeat_yearly,
  is_enabled,
  logo_url,
  notes,
  created_by
)
VALUES (
  'WORKSPACE_ID_FROM_STEP1',
  'Spring Sale 2025',
  CURRENT_DATE,
  'Sale',
  false,
  true,
  'https://socialflows.vercel.app/api/media/2dbf3957-7b5e-40b9-ad9d-415e17b9fad8/content',
  'Testing with uploaded media',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);
```

### Step 4: Add Instagram Credentials

```sql
INSERT INTO meta_apps (
  workspace_id,
  name,
  app_id,
  instagram_business_account_id,
  instagram_access_token
)
VALUES (
  'WORKSPACE_ID_FROM_STEP1',
  'Test Meta App',
  'test-app-id',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'YOUR_INSTAGRAM_ACCESS_TOKEN'
);
```

### Step 5: Update `.env.local`

```env
DATABASE_URL=your-neon-connection-string
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-fallback-account-id
INSTAGRAM_ACCESS_TOKEN=your-fallback-token
INSTAGRAM_GRAPH_API_VERSION=v23.0
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 6: Start Dev Server

```bash
pnpm dev
```

### Step 7: Trigger Auto Posting

**PowerShell** (recommended - no popup):
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-scheduled-messages" `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

Or **curl**:
```bash
curl http://localhost:3000/api/cron/process-scheduled-messages
```

### Step 8: Check Results

```sql
-- View created posts
SELECT 
  id,
  status,
  posted_at,
  instagram_post_id,
  failure_reason,
  engagement_status,
  created_at
FROM calendar_event_posts
WHERE workspace_id = 'WORKSPACE_ID_FROM_STEP1'
ORDER BY created_at DESC;

-- View the media was used
SELECT 
  logo_url,
  event_name,
  event_date,
  post_title,
  caption
FROM calendar_event_posts
WHERE workspace_id = 'WORKSPACE_ID_FROM_STEP1'
LIMIT 1;
```

## Expected Behavior

### First Cron Run
```json
{
  "success": true,
  "processed": 0,
  "calendarSeeds": 0,        // No festivals today (unless it's a special date)
  "calendarPosts": 0         // Post created in draft status
}
```

Check DB - post should have:
- `status`: `scheduled`
- `logo_url`: Your media URL
- `creative_preview_url`: Generated preview URL
- `scheduled_for`: Future time (or now)

### Second Cron Run
```json
{
  "success": true,
  "processed": 0,
  "calendarSeeds": 0,
  "calendarPosts": 1         // Post published to Instagram!
}
```

Check DB - post should have:
- `status`: `posted`
- `posted_at`: Current timestamp
- `instagram_post_id`: IGP_xxxxx format
- `engagement_status`: `posted`

## Troubleshooting

### Media URL is Inaccessible
```bash
# Test if URL works
curl -I https://socialflows.vercel.app/api/media/2dbf3957-7b5e-40b9-ad9d-415e17b9fad8/content

# Should return 200 OK with image headers
```

### Post Status Stays "Failed"
Check `failure_reason` column:
```sql
SELECT failure_reason FROM calendar_event_posts 
WHERE id = 'POST_ID_HERE';
```

Common issues:
- `"Failed to create Instagram media container"` → Invalid Instagram token
- `"Failed to publish Instagram media"` → API rate limit or account issue
- `"Network error"` → URL unreachable by Instagram

### Test Without Instagram (Mock Mode)

Edit `app/api/cron/process-scheduled-messages/route.ts` around line 285:

```typescript
const credentialsRows = await sql`...`;
// Add this mock block:
if (process.env.MOCK_INSTAGRAM === 'true') {
  const mockPostId = `IGP_MOCK_${Date.now()}`;
  await sql`
    UPDATE calendar_event_posts
    SET 
      status = 'posted',
      posted_at = CURRENT_TIMESTAMP,
      instagram_post_id = ${mockPostId},
      engagement_status = 'posted'
    WHERE id = ${post.id}
  `;
  console.log('[CRON] MOCK POST:', mockPostId);
  return;
}
// Rest of Instagram API calls...
```

Then set:
```env
MOCK_INSTAGRAM=true
```

## What Gets Posted to Instagram

The cron generates an SVG creative using:
- Event name: `Spring Sale 2025`
- Your logo: The media file you uploaded
- Event date: Today
- Business branding colors from workspace settings
- Auto-generated caption and title

The resulting post on Instagram will include:
- Your logo prominently
- Festival/event name
- Business name
- Call-to-action

## Next Steps

1. Run Steps 1-7 above
2. Check your Instagram Insights for the posted content
3. Monitor `engagement_status` and `posted_at` timestamps
4. Adjust logo/branding in calendar settings as needed


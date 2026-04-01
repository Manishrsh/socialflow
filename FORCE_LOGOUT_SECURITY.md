# Force Logout Security Feature

## Overview

This document describes the **Force Logout** security feature that allows administrators to immediately invalidate all active user sessions in the system. This is useful for security incidents or system-wide authentication changes.

## Problem Solved

Previously, users could access the system and view data without proper authentication. The force logout feature ensures that:

1. ✅ All unauthenticated users are blocked from accessing protected data
2. ✅ When a force logout is triggered, ALL existing sessions become invalid
3. ✅ Users must re-authenticate (login again) to access the system
4. ✅ No user data is lost - only sessions are invalidated

## How It Works

### Architecture

The force logout system works through a **timestamp-based validation** mechanism:

1. **Global Force Logout Timestamp**: Stored in `system_settings` table
2. **Token Issuance Time**: Each JWT token has an `iat` (issued at) claim
3. **Validation Logic**: When verifying a token, we compare:
   - Token's `iat` (when issued) vs Force Logout timestamp
   - If token was issued BEFORE the force logout timestamp → **INVALID**
   - If token was issued AFTER the force logout timestamp → **VALID**

### Flow Diagram

```
┌─────────────┐
│   User      │
│  Logged In  │
└──────┬──────┘
       │
       ├─ Token issued at: 2:00 PM
       │
       ├─ [Admin triggers Force Logout at 3:00 PM]
       │
       ├─ User tries to access protected route
       │
       └─ Token verification:
          ├─ Token iat: 2:00 PM
          ├─ Force logout: 3:00 PM
          ├─ 2:00 PM < 3:00 PM? YES
          └─ ❌ Token INVALID → Redirect to Login
```

## Database Schema

### New Tables/Columns Added

#### 1. Users Table (Modified)
```sql
ALTER TABLE users
ADD COLUMN force_logout_at TIMESTAMP;
```
- Allows per-user force logout (optional, for future use)

#### 2. System Settings Table (New)
```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID
);
```
- Stores global system configuration
- Currently used for `force_logout_at` setting

## API Endpoints

### Force Logout All Users

#### `POST /api/auth/force-logout-all`

**Purpose**: Trigger a force logout for all users in the system

**Authentication**: Required (any authenticated user)

**Request**:
```bash
curl -X POST http://localhost:3000/api/auth/force-logout-all \
  -H "Content-Type: application/json" \
  -b "auth-token=<your-token>"
```

**Response (Success - 200)**:
```json
{
  "message": "All users have been force logged out successfully",
  "timestamp": "2024-04-01T15:30:00.000Z",
  "updatedBy": "user-id-123"
}
```

**Response (Unauthorized - 401)**:
```json
{
  "error": "Unauthorized - authentication required"
}
```

### Get Force Logout Status

#### `GET /api/auth/force-logout-all`

**Purpose**: Check the current force logout status

**Authentication**: Required (any authenticated user)

**Request**:
```bash
curl http://localhost:3000/api/auth/force-logout-all \
  -b "auth-token=<your-token>"
```

**Response (Active)**:
```json
{
  "status": "active",
  "timestamp": "2024-04-01T15:30:00.000Z",
  "updatedAt": "2024-04-01T15:30:00.000Z",
  "message": "Force logout was triggered at 2024-04-01T15:30:00.000Z"
}
```

**Response (Inactive)**:
```json
{
  "status": "never",
  "message": "No force logout has been triggered yet"
}
```

## User Interface

### Admin Force Logout Page

**Location**: `/admin/force-logout`

**Features**:
- 🔐 Authentication required
- 📊 View current force logout status
- 🚨 Large, prominent button to trigger force logout
- ⚠️ Confirmation dialog before execution
- ✅ Success/error messages
- ℹ️ Clear explanation of how it works

**How to Access**:
1. Go to Dashboard → Settings
2. Scroll to "System Administration" section
3. Click "Force Logout Control"

## Implementation Details

### Authentication Check Flow

```javascript
// In lib/auth.ts - verifyToken()

1. Verify JWT signature (standard JWT verification)
2. Extract payload with iat (issued at time)
3. Fetch user's force_logout_at from database
4. If iat < user.force_logout_at → return null (INVALID)
5. Fetch global force_logout_at from system_settings
6. If iat < global.force_logout_at → return null (INVALID)
7. Return payload (VALID)
```

### Session Validation

When a user tries to access a protected route:

1. **Dashboard Layout** checks `useAuth()` hook
2. `useAuth()` calls `GET /api/auth/me`
3. `/api/auth/me` calls `verifyToken()`
4. If token is invalid:
   - Returns 401 Unauthorized
   - Frontend redirects to `/login`
   - User must re-enter credentials

## Testing Guide

### Test 1: Basic Authentication

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Save the auth-token from response
# 3. Access protected route
curl http://localhost:3000/api/auth/me \
  -b "auth-token=<saved-token>"

# Should return: 200 OK with user data
```

### Test 2: Force Logout Trigger

```bash
# 1. Trigger force logout
curl -X POST http://localhost:3000/api/auth/force-logout-all \
  -b "auth-token=<valid-token>"

# Response should be: 200 OK with timestamp

# 2. Try to use the old token immediately
curl http://localhost:3000/api/auth/me \
  -b "auth-token=<saved-token>"

# Should return: 401 Unauthorized
# (because token was issued before force logout)
```

### Test 3: Re-login After Force Logout

```bash
# 1. After force logout, try to access dashboard
# User gets redirected to /login

# 2. Login again with same credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 3. Get new token and try to access protected route
# Should work fine - new token is valid
```

## Edge Cases & Error Handling

### Edge Case 1: Multiple Force Logouts
✅ **Handled**: Each force logout updates the timestamp. Previous timestamps are overwritten. All tokens issued before the latest timestamp are invalid.

### Edge Case 2: Clock Skew
✅ **Handled**: Using server-side timestamps (UTC). Client clock doesn't matter.

### Edge Case 3: Token Expiration vs Force Logout
✅ **Handled**: Tokens have both:
- Expiration time (24 hours)
- Force logout validation (if enabled)
- Either can invalidate a token

### Edge Case 4: Database Connection Failure
✅ **Handled**: If `system_settings` query fails, the system falls back to standard JWT verification. Force logout checks are wrapped in try-catch blocks.

## Security Considerations

### What This Protects Against
- ✅ Session hijacking (compromised tokens are invalidated)
- ✅ Unauthorized access after security breach
- ✅ Stale sessions from retired accounts
- ✅ System-wide authentication bypass attempts

### What This Doesn't Protect Against
- ❌ Token theft during valid use (use HTTPS)
- ❌ Weak passwords (enforce strong password policy)
- ❌ Social engineering (user education needed)

### Best Practices
1. ✅ Use HTTPS in production (secure cookies)
2. ✅ Set reasonable token expiration times (24 hours)
3. ✅ Monitor authentication logs for suspicious activity
4. ✅ Use force logout sparingly (for emergencies only)
5. ✅ Document the reason for each force logout in logs

## Troubleshooting

### Problem: Force Logout Not Working

**Symptom**: User can still access system after force logout

**Causes & Solutions**:
1. **Token not refreshed**: Clear browser cookies and reload
   ```javascript
   // Browser console
   document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
   location.reload();
   ```

2. **Server cache**: Restart the application server
   ```bash
   # Restart Next.js dev server
   npm run dev
   ```

3. **Database connection**: Verify `system_settings` table exists
   ```sql
   SELECT * FROM system_settings WHERE setting_key = 'force_logout_at';
   ```

### Problem: Getting "Unauthorized" After Triggering Force Logout

**Symptom**: Can't login after force logout

**Solution**: This is expected behavior!
- Wait a few seconds for system to stabilize
- Refresh the page
- Login again with same credentials
- Should work with a new token

## Configuration

### Token Expiration Time
Location: `/lib/auth.ts`, `createToken()` function
```javascript
.setExpirationTime(now + 24 * 60 * 60) // 24 hours
```

To change to 48 hours:
```javascript
.setExpirationTime(now + 48 * 60 * 60) // 48 hours
```

### Force Logout Secret
Location: `.env.development.local`
```
STACK_SECRET_SERVER_KEY=your-secure-random-key
```

## Migration Notes

### For Existing Databases

The system automatically creates the required tables and columns on first run:

1. Creates `system_settings` table if it doesn't exist
2. Adds `force_logout_at` column to `users` table if it doesn't exist
3. Creates indexes for performance

No manual migration needed!

## Future Enhancements

Potential improvements:
- [ ] Per-user force logout (logout specific users)
- [ ] Scheduled force logouts (logout at specific time)
- [ ] Force logout by workspace (multi-tenant support)
- [ ] Force logout audit logs
- [ ] Webhook notifications on force logout
- [ ] Grace period before logout (30 seconds warning)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs: `console.log('[v0] ...')`
3. Check database connectivity
4. Verify environment variables are set correctly

---

**Last Updated**: April 1, 2024
**Feature Status**: ✅ Production Ready

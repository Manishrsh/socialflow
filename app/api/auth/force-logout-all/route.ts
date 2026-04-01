import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * POST /api/auth/force-logout-all
 * 
 * Force logout all users in the system immediately.
 * Only authenticated users can trigger this (basic protection).
 * 
 * This invalidates all existing sessions by setting a global force_logout_at timestamp.
 * All tokens issued before this timestamp will be considered invalid.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureCoreSchema();

    // Verify user is authenticated (basic protection)
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Get the current user to check if they have admin permissions
    const users = await sql`
      SELECT role FROM users WHERE id = ${session.userId}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // For now, allow any authenticated user to force logout (you can add role checking)
    // If you want to restrict to admin only, uncomment this:
    // if (users[0].role !== 'admin' && users[0].role !== 'owner') {
    //   return NextResponse.json(
    //     { error: 'Forbidden - admin access required' },
    //     { status: 403 }
    //   );
    // }

    const now = new Date();

    // Update global settings with force logout timestamp
    const result = await sql`
      INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
      VALUES ('force_logout_at', ${{ timestamp: now.toISOString() }}, ${now}, ${session.userId})
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = ${{ timestamp: now.toISOString() }},
        updated_at = ${now},
        updated_by = ${session.userId}
      RETURNING setting_value, updated_at
    `;

    console.log('[v0] Force logout triggered for all users at:', now.toISOString());

    return NextResponse.json({
      message: 'All users have been force logged out successfully',
      timestamp: now.toISOString(),
      updatedBy: session.userId,
    });
  } catch (error: any) {
    console.error('[v0] Force logout error:', error);
    return NextResponse.json(
      { error: 'Failed to force logout users: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/force-logout-all
 * 
 * Get the current force logout status
 */
export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    // Verify user is authenticated
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const settings = await sql`
      SELECT setting_value, updated_at FROM system_settings 
      WHERE setting_key = 'force_logout_at'
    `;

    if (settings.length === 0) {
      return NextResponse.json({
        status: 'never',
        message: 'No force logout has been triggered yet',
      });
    }

    const { timestamp } = settings[0].setting_value || {};

    return NextResponse.json({
      status: timestamp ? 'active' : 'inactive',
      timestamp: timestamp || null,
      updatedAt: settings[0].updated_at,
      message: timestamp 
        ? `Force logout was triggered at ${new Date(timestamp).toISOString()}`
        : 'No active force logout',
    });
  } catch (error: any) {
    console.error('[v0] Error fetching force logout status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch force logout status: ' + error.message },
      { status: 500 }
    );
  }
}

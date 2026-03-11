import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureCoreSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const payload = await verifyToken(token);
      if (!payload || !payload.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        );
      }

      const userId = payload.userId;

      try {
        const users = await sql`
          SELECT id, email, name, company_name FROM users WHERE id = ${userId}
        `;

        if (!users || users.length === 0) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        const user = users[0];

        const workspaces = await sql`
          SELECT id, name FROM workspaces WHERE owner_id = ${userId} LIMIT 1
        `;

        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            companyName: user.company_name,
          },
          workspace: (workspaces && workspaces[0]) || null,
        });
      } catch (dbError) {
        console.error('[v0] Database error in auth/me:', dbError);
        // Return basic user info if database fails
        return NextResponse.json({
          user: {
            id: payload.userId,
            email: payload.email,
            name: 'User',
          },
          workspace: null,
        });
      }
    } catch (tokenError) {
      console.error('[v0] Token verification error:', tokenError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[v0] Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

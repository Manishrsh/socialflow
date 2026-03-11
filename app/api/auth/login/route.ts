import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    let user: any = null;

    await ensureCoreSchema();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    try {
      // Get user
      const users = await sql`
        SELECT id, email, name, company_name
        FROM users
        WHERE LOWER(email) = ${normalizedEmail}
      `;

      if (!users || users.length === 0) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      user = users[0];
      console.log('[v0] Login attempt for user:', user.email);
      // Get password hash
      const passwordHashes = await sql`
        SELECT password_hash FROM auth_passwords WHERE user_id = ${user.id}
      `;

      if (!passwordHashes || passwordHashes.length === 0) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // Verify password
      const isValid = await verifyPassword(password, passwordHashes[0].password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    } catch (dbError) {
      console.error('[v0] Login database error:', dbError);
      return NextResponse.json(
        { error: 'Database error - please try again' },
        { status: 500 }
      );
    }

    // Create session
    const token = await createToken({ userId: user.id, email: user.email });

    // Get workspace
    const workspaces = await sql`
      SELECT id, name FROM workspaces WHERE owner_id = ${user.id} LIMIT 1
    `;

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.company_name,
      },
      workspace: workspaces[0] || null,
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

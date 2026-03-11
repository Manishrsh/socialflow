import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, companyName } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    await ensureCoreSchema();

    // Validate input
    if (!normalizedEmail || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE LOWER(email) = ${normalizedEmail}
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create user
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await sql`
      INSERT INTO users (id, email, name, company_name, role, subscription_tier) 
      VALUES (${userId}, ${normalizedEmail}, ${name}, ${companyName || null}, ${'owner'}, ${'free'})
    `;

    // Store password hash
    await sql`
      INSERT INTO auth_passwords (user_id, password_hash) 
      VALUES (${userId}, ${passwordHash})
    `;

    // Create default workspace
    const workspaceId = randomUUID();
    await sql`
      INSERT INTO workspaces (id, owner_id, name, slug) 
      VALUES (${workspaceId}, ${userId}, ${`${name}'s Workspace`}, ${workspaceId.slice(0, 8)})
    `;

    const token = await createToken({ userId, email: normalizedEmail });
    const response = NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: userId,
          email: normalizedEmail,
          name,
          companyName: companyName || null,
        },
        workspace: {
          id: workspaceId,
          name: `${name}'s Workspace`,
        },
      },
      { status: 201 }
    );

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

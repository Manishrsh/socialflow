import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { workspaceId, name, phone, email, tags = [] } = await request.json();

    if (!workspaceId || !name || !phone) {
      return NextResponse.json(
        { error: 'Workspace ID, name, and phone are required' },
        { status: 400 }
      );
    }

    const customerId = uuidv4();

    await query(
      `INSERT INTO customers (id, workspace_id, name, phone, email, tags)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [customerId, workspaceId, name, phone, email || null, tags]
    );

    return NextResponse.json(
      { customerId, message: 'Customer created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Customer creation error:', error);
    if (error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Customer with this phone already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

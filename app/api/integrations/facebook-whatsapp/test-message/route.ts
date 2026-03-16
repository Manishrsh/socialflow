import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import { ensureCoreSchema, sql } from '@/lib/db';
import { queueOwnBspMessage } from '@/lib/own-bsp-service';

async function authUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    return verifySession(token);
}

export async function POST(request: NextRequest) {
    try {
        const userId = await authUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const workspaceId = String(body?.workspaceId || '').trim();
        const phone = String(body?.phone || '').trim();
        const message = String(body?.message || '').trim();

        if (!workspaceId || !phone || !message) {
            return NextResponse.json({ error: 'workspaceId, phone, and message are required' }, { status: 400 });
        }

        const owned = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND owner_id = ${userId} LIMIT 1
    `;
        if (!owned || owned.length === 0) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const { success, error } = await queueOwnBspMessage({
            workspaceId,
            channel: 'whatsapp',
            recipient: phone,
            message,
            payload: { source: 'test_message' }
        });

        if (!success) {
            return NextResponse.json({ error: error || 'Failed to send message' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Message queued to Meta successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to send test message' }, { status: 500 });
    }
}

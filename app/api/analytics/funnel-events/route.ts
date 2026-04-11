import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const customerId = request.nextUrl.searchParams.get('customerId');
    const stage = request.nextUrl.searchParams.get('stage');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    let query = `
      SELECT
        id,
        customer_id,
        stage,
        triggered_at,
        metadata
      FROM sales_funnel_events
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (customerId) {
      query += ` AND customer_id = $${params.length + 1}`;
      params.push(customerId);
    }

    if (stage) {
      query += ` AND stage = $${params.length + 1}`;
      params.push(stage);
    }

    query += ` ORDER BY triggered_at DESC LIMIT 100`;

    const events = await sql.unsafe(query, params);

    return NextResponse.json({
      events: events.map((e: any) => ({
        id: e.id,
        customer_id: e.customer_id,
        stage: e.stage,
        triggered_at: e.triggered_at,
        metadata: e.metadata,
      })),
      total: events.length,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Funnel events GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, customerId, stage, metadata } = body;

    if (!workspaceId || !customerId || !stage) {
      return NextResponse.json(
        { error: 'workspaceId, customerId, and stage are required' },
        { status: 400 }
      );
    }

    // Validate stage
    const validStages = ['inquiry', 'discussion', 'purchase', 'completion'];
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await sql`
      SELECT id FROM customers WHERE id = ${customerId} AND workspace_id = ${workspaceId}
    `;

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Create funnel event
    const eventId = uuidv4();
    await sql`
      INSERT INTO sales_funnel_events (id, workspace_id, customer_id, stage, metadata)
      VALUES (${eventId}, ${workspaceId}, ${customerId}, ${stage}, ${JSON.stringify(metadata || {})})
    `;

    // Update customer segment if moving to purchase/completion
    if (['purchase', 'completion'].includes(stage)) {
      await sql`
        UPDATE customers
        SET customer_segment = 'hot'
        WHERE id = ${customerId} AND customer_segment != 'hot'
      `;
    }

    return NextResponse.json({
      id: eventId,
      customer_id: customerId,
      stage,
      triggered_at: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('[API] Funnel events POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

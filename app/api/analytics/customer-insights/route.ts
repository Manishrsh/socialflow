import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { sql } from '@/lib/db';

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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId}
    `;

    if (workspace.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (customerId) {
      // Get insights for specific customer
      const customer = await sql`
        SELECT
          c.id,
          c.phone,
          c.name,
          c.email,
          c.customer_segment,
          c.lifetime_value,
          c.intent_score,
          c.customer_tags,
          c.is_lost,
          c.created_at,
          COUNT(m.id) as total_messages,
          SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_messages,
          SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_messages,
          AVG(CASE WHEN m.sentiment = 'positive' THEN 1 WHEN m.sentiment = 'negative' THEN 0 ELSE 0.5 END) as avg_sentiment,
          STRING_AGG(DISTINCT m.intent, ', ') as intents,
          STRING_AGG(DISTINCT m.sentiment, ', ') as sentiments,
          MAX(m.sent_at) as last_message_at
        FROM customers c
        LEFT JOIN messages m ON c.id = m.customer_id
        WHERE c.workspace_id = ${workspaceId} AND c.id = ${customerId}
        GROUP BY c.id, c.phone, c.name, c.email, c.customer_segment, c.lifetime_value, c.intent_score, c.customer_tags, c.is_lost, c.created_at
      `;

      if (customer.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      const cust = customer[0];
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(cust.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return NextResponse.json({
        customer: {
          id: cust.id,
          phone: cust.phone,
          name: cust.name || 'Unknown',
          email: cust.email,
          segment: cust.customer_segment,
          lifetime_value: cust.lifetime_value,
          intent_score: cust.intent_score,
          tags: cust.customer_tags || [],
          is_lost: cust.is_lost,
          created_at: cust.created_at,
        },
        conversation_metrics: {
          total_messages: cust.total_messages,
          inbound_messages: cust.inbound_messages,
          outbound_messages: cust.outbound_messages,
          avg_sentiment: cust.avg_sentiment,
          intents_detected: cust.intents ? cust.intents.split(', ').filter((i: string) => i) : [],
          sentiments_detected: cust.sentiments ? cust.sentiments.split(', ').filter((s: string) => s) : [],
          last_contact: cust.last_message_at,
          customer_age_days: daysSinceCreation,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      // Get list of all customers with insights
      const customers = await sql`
        SELECT
          c.id,
          c.phone,
          c.name,
          c.customer_segment,
          c.lifetime_value,
          c.intent_score,
          c.is_lost,
          COUNT(m.id) as total_messages,
          MAX(m.sent_at) as last_message_at,
          AVG(CASE WHEN m.sentiment = 'positive' THEN 1 WHEN m.sentiment = 'negative' THEN 0 ELSE 0.5 END) as avg_sentiment
        FROM customers c
        LEFT JOIN messages m ON c.id = m.customer_id
        WHERE c.workspace_id = ${workspaceId}
        GROUP BY c.id, c.phone, c.name, c.customer_segment, c.lifetime_value, c.intent_score, c.is_lost
        ORDER BY c.lifetime_value DESC, c.intent_score DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({
        customers: customers.map((c: any) => ({
          id: c.id,
          phone: c.phone,
          name: c.name || 'Unknown',
          segment: c.customer_segment,
          lifetime_value: c.lifetime_value,
          intent_score: c.intent_score,
          is_lost: c.is_lost,
          total_messages: c.total_messages,
          avg_sentiment: c.avg_sentiment,
          last_contact: c.last_message_at,
        })),
        summary: {
          total_customers: customers.length,
          by_segment: {
            hot: customers.filter((c: any) => c.customer_segment === 'hot').length,
            warm: customers.filter((c: any) => c.customer_segment === 'warm').length,
            cold: customers.filter((c: any) => c.customer_segment === 'cold').length,
            new: customers.filter((c: any) => c.customer_segment === 'new').length,
            returning: customers.filter((c: any) => c.customer_segment === 'returning').length,
            ghost: customers.filter((c: any) => c.customer_segment === 'ghost').length,
          },
          total_lifetime_value: customers.reduce((sum: number, c: any) => sum + (c.lifetime_value || 0), 0),
          avg_intent_score: Math.round(
            (customers.reduce((sum: number, c: any) => sum + (c.intent_score || 0), 0) / customers.length) * 100
          ) / 100,
        },
        metadata: {
          limit,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('[API] Customer insights endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

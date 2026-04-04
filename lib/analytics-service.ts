import { sql } from './db';
import { detectCustomerSegment } from './nlp-engine';

export interface SalesFunnelMetrics {
  inquiry: number;
  discussion: number;
  purchase: number;
  completion: number;
}

export interface ConversionRates {
  inquiry_to_discussion: number;
  discussion_to_purchase: number;
  purchase_to_completion: number;
  overall: number;
}

export interface ProductDemandItem {
  product: string;
  mentions: number;
  inquiries: number;
  conversions: number;
  revenue: number;
  trend: string;
}

export interface StaffPerformanceMetrics {
  staff_id: string;
  chats_handled: number;
  messages_sent: number;
  avg_response_time: number;
  first_response_time: number;
  conversion_rate: number;
  customer_satisfaction: number;
}

/**
 * Get sales funnel metrics for a date range
 */
export async function getSalesFunnel(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{ funnel: SalesFunnelMetrics; conversions: ConversionRates }> {
  try {
    const stages = await sql`
      SELECT
        stage,
        COUNT(DISTINCT customer_id) as count
      FROM sales_funnel_events
      WHERE workspace_id = ${workspaceId}
        AND triggered_at >= ${startDate.toISOString()}
        AND triggered_at <= ${endDate.toISOString()}
      GROUP BY stage
    `;

    const funnel: SalesFunnelMetrics = {
      inquiry: 0,
      discussion: 0,
      purchase: 0,
      completion: 0,
    };

    stages.forEach((stage: any) => {
      if (stage.stage in funnel) {
        funnel[stage.stage as keyof SalesFunnelMetrics] = stage.count;
      }
    });

    // Calculate conversion rates
    const conversions: ConversionRates = {
      inquiry_to_discussion: funnel.inquiry > 0 ? (funnel.discussion / funnel.inquiry) * 100 : 0,
      discussion_to_purchase: funnel.discussion > 0 ? (funnel.purchase / funnel.discussion) * 100 : 0,
      purchase_to_completion: funnel.purchase > 0 ? (funnel.completion / funnel.purchase) * 100 : 0,
      overall: funnel.inquiry > 0 ? (funnel.completion / funnel.inquiry) * 100 : 0,
    };

    return { funnel, conversions };
  } catch (error) {
    console.error('[Analytics] Failed to get sales funnel:', error);
    return {
      funnel: { inquiry: 0, discussion: 0, purchase: 0, completion: 0 },
      conversions: { inquiry_to_discussion: 0, discussion_to_purchase: 0, purchase_to_completion: 0, overall: 0 },
    };
  }
}

/**
 * Get lost leads (customers with no recent response)
 */
export async function getLostLeads(
  workspaceId: string,
  days: number = 7
): Promise<any[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const lostLeads = await sql`
      SELECT
        c.id,
        c.phone,
        c.name,
        c.customer_segment,
        c.intent_score,
        COUNT(m.id) as message_count,
        MAX(m.sent_at) as last_message_at,
        EXTRACT(DAY FROM NOW() - MAX(m.sent_at)) as days_inactive
      FROM customers c
      LEFT JOIN messages m ON c.id = m.customer_id
      WHERE c.workspace_id = ${workspaceId}
        AND c.is_lost = false
        AND (MAX(m.sent_at) IS NULL OR MAX(m.sent_at) < ${cutoffDate.toISOString()})
      GROUP BY c.id, c.phone, c.name, c.customer_segment, c.intent_score
      HAVING COUNT(m.id) > 0 OR c.created_at < ${cutoffDate.toISOString()}
      ORDER BY c.intent_score DESC, MAX(m.sent_at) ASC
      LIMIT 50
    `;

    return lostLeads;
  } catch (error) {
    console.error('[Analytics] Failed to get lost leads:', error);
    return [];
  }
}

/**
 * Get product demand analytics
 */
export async function getProductDemand(
  workspaceId: string,
  limit: number = 10
): Promise<ProductDemandItem[]> {
  try {
    const products = await sql`
      SELECT
        product_name,
        mention_count,
        inquiry_count,
        conversion_count,
        revenue,
        trend
      FROM product_demand
      WHERE workspace_id = ${workspaceId}
      ORDER BY mention_count DESC
      LIMIT ${limit}
    `;

    return products.map((p: any) => ({
      product: p.product_name,
      mentions: p.mention_count,
      inquiries: p.inquiry_count,
      conversions: p.conversion_count,
      revenue: parseFloat(p.revenue) || 0,
      trend: p.trend || 'stable',
    }));
  } catch (error) {
    console.error('[Analytics] Failed to get product demand:', error);
    return [];
  }
}

/**
 * Get top keywords
 */
export async function getTopKeywords(
  workspaceId: string,
  limit: number = 15,
  productType?: string
): Promise<any[]> {
  try {
    let query = `
      SELECT
        keyword,
        frequency,
        sentiment,
        last_seen
      FROM keyword_frequency
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (productType) {
      query += ` AND product_type = $2`;
      params.push(productType);
    }

    query += ` ORDER BY frequency DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const keywords = await sql.unsafe(query, params);
    return keywords;
  } catch (error) {
    console.error('[Analytics] Failed to get top keywords:', error);
    return [];
  }
}

/**
 * Get customer sentiment distribution
 */
export async function getSentimentDistribution(
  workspaceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ positive: number; neutral: number; negative: number; average: number }> {
  try {
    let query = `
      SELECT
        sentiment,
        COUNT(*) as count,
        AVG(sentiment_score) as avg_score
      FROM messages
      WHERE workspace_id = $1 AND sentiment IS NOT NULL
    `;
    const params: any[] = [workspaceId];

    if (startDate) {
      query += ` AND sent_at >= $${params.length + 1}`;
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ` AND sent_at <= $${params.length + 1}`;
      params.push(endDate.toISOString());
    }

    query += ` GROUP BY sentiment`;

    const results = await sql.unsafe(query, params);

    const distribution = { positive: 0, neutral: 0, negative: 0, average: 0.5 };
    let totalScore = 0;
    let totalCount = 0;

    results.forEach((row: any) => {
      if (row.sentiment === 'positive') distribution.positive = row.count;
      if (row.sentiment === 'neutral') distribution.neutral = row.count;
      if (row.sentiment === 'negative') distribution.negative = row.count;
      totalScore += (row.avg_score || 0.5) * row.count;
      totalCount += row.count;
    });

    if (totalCount > 0) {
      distribution.average = Math.round((totalScore / totalCount) * 100) / 100;
    }

    return distribution;
  } catch (error) {
    console.error('[Analytics] Failed to get sentiment distribution:', error);
    return { positive: 0, neutral: 0, negative: 0, average: 0.5 };
  }
}

/**
 * Get customer intent distribution
 */
export async function getIntentDistribution(
  workspaceId: string
): Promise<{ [key: string]: { count: number; conversion_rate: number } }> {
  try {
    const intents = await sql`
      SELECT
        intent,
        COUNT(*) as count,
        AVG(CASE WHEN direction = 'outbound' AND response_time_seconds IS NOT NULL THEN 1 ELSE 0 END) as conversion_rate
      FROM messages
      WHERE workspace_id = ${workspaceId} AND intent IS NOT NULL
      GROUP BY intent
      ORDER BY count DESC
    `;

    const distribution: { [key: string]: { count: number; conversion_rate: number } } = {};

    intents.forEach((intent: any) => {
      distribution[intent.intent] = {
        count: intent.count,
        conversion_rate: Math.round((intent.conversion_rate || 0) * 100),
      };
    });

    return distribution;
  } catch (error) {
    console.error('[Analytics] Failed to get intent distribution:', error);
    return {};
  }
}

/**
 * Get customer lifetime value statistics
 */
export async function getCustomerLTV(
  workspaceId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const customers = await sql`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.lifetime_value,
        c.customer_segment,
        COUNT(m.id) as total_messages,
        EXTRACT(DAY FROM AGE(NOW(), c.created_at)) as customer_age_days
      FROM customers c
      LEFT JOIN messages m ON c.id = m.customer_id
      WHERE c.workspace_id = ${workspaceId}
      GROUP BY c.id, c.name, c.phone, c.lifetime_value, c.customer_segment
      ORDER BY c.lifetime_value DESC
      LIMIT ${limit}
    `;

    return customers;
  } catch (error) {
    console.error('[Analytics] Failed to get customer LTV:', error);
    return [];
  }
}

/**
 * Get response time analytics
 */
export async function getResponseTimeAnalytics(
  workspaceId: string
): Promise<{
  avg_response_time: number;
  median_response_time: number;
  p95_response_time: number;
  delayed_responses: number;
}> {
  try {
    const metrics = await sql`
      SELECT
        AVG(response_time_seconds) as avg_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_seconds) as median_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_seconds) as p95_time,
        COUNT(CASE WHEN response_time_seconds > 300 THEN 1 END) as delayed_count
      FROM messages
      WHERE workspace_id = ${workspaceId} AND response_time_seconds IS NOT NULL
    `;

    if (metrics.length === 0) {
      return { avg_response_time: 0, median_response_time: 0, p95_response_time: 0, delayed_responses: 0 };
    }

    const data = metrics[0];
    return {
      avg_response_time: Math.round(data.avg_time || 0),
      median_response_time: Math.round(data.median_time || 0),
      p95_response_time: Math.round(data.p95_time || 0),
      delayed_responses: data.delayed_count || 0,
    };
  } catch (error) {
    console.error('[Analytics] Failed to get response time analytics:', error);
    return { avg_response_time: 0, median_response_time: 0, p95_response_time: 0, delayed_responses: 0 };
  }
}

/**
 * Get staff performance metrics
 */
export async function getStaffPerformance(
  workspaceId: string,
  metricDate?: Date
): Promise<StaffPerformanceMetrics[]> {
  try {
    const date = metricDate || new Date();
    const dateStr = date.toISOString().split('T')[0];

    const staffMetrics = await sql`
      SELECT
        staff_id,
        chats_handled,
        messages_sent,
        avg_response_time_seconds,
        first_response_time_seconds,
        COALESCE(conversions::numeric / NULLIF(chats_handled, 0) * 100, 0) as conversion_rate,
        COALESCE(customer_satisfaction_score, 0) as customer_satisfaction
      FROM staff_performance
      WHERE workspace_id = ${workspaceId}
        AND metric_date = ${dateStr}
      ORDER BY conversions DESC
    `;

    return staffMetrics;
  } catch (error) {
    console.error('[Analytics] Failed to get staff performance:', error);
    return [];
  }
}

/**
 * Update daily metrics aggregation
 */
export async function updateDailyMetrics(workspaceId: string, date: Date = new Date()): Promise<void> {
  try {
    const dateStr = date.toISOString().split('T')[0];

    // Calculate metrics for the day
    const metrics = await sql`
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outgoing,
        COUNT(DISTINCT customer_id) as unique_customers,
        AVG(CASE WHEN sentiment = 'positive' THEN 1 WHEN sentiment = 'negative' THEN 0 ELSE 0.5 END) as avg_sentiment,
        AVG(response_time_seconds) as avg_response_time
      FROM messages
      WHERE workspace_id = ${workspaceId}
        AND DATE(sent_at) = ${dateStr}
    `;

    if (metrics.length === 0) return;

    const data = metrics[0];

    // Get segment counts
    const segments = await sql`
      SELECT
        customer_segment,
        COUNT(*) as count
      FROM customers
      WHERE workspace_id = ${workspaceId}
      GROUP BY customer_segment
    `;

    const segmentCounts = {
      hot: 0,
      warm: 0,
      cold: 0,
      lost: 0,
    };

    segments.forEach((seg: any) => {
      if (seg.customer_segment in segmentCounts) {
        segmentCounts[seg.customer_segment as keyof typeof segmentCounts] = seg.count;
      }
    });

    // Upsert daily metrics
    await sql`
      INSERT INTO daily_metrics (
        workspace_id,
        metric_date,
        total_messages,
        incoming_messages,
        outgoing_messages,
        unique_customers,
        avg_sentiment,
        hot_leads_count,
        warm_leads_count,
        cold_leads_count,
        lost_leads_count,
        avg_response_time_seconds
      )
      VALUES (
        ${workspaceId},
        ${dateStr},
        ${data.total_messages || 0},
        ${data.incoming || 0},
        ${data.outgoing || 0},
        ${data.unique_customers || 0},
        ${data.avg_sentiment || 0.5},
        ${segmentCounts.hot},
        ${segmentCounts.warm},
        ${segmentCounts.cold},
        ${segmentCounts.lost},
        ${data.avg_response_time || 0}
      )
      ON CONFLICT (workspace_id, metric_date)
      DO UPDATE SET
        total_messages = EXCLUDED.total_messages,
        incoming_messages = EXCLUDED.incoming_messages,
        outgoing_messages = EXCLUDED.outgoing_messages,
        unique_customers = EXCLUDED.unique_customers,
        avg_sentiment = EXCLUDED.avg_sentiment,
        hot_leads_count = EXCLUDED.hot_leads_count,
        warm_leads_count = EXCLUDED.warm_leads_count,
        cold_leads_count = EXCLUDED.cold_leads_count,
        lost_leads_count = EXCLUDED.lost_leads_count,
        avg_response_time_seconds = EXCLUDED.avg_response_time_seconds
    `;
  } catch (error) {
    console.error('[Analytics] Failed to update daily metrics:', error);
  }
}

/**
 * Detect and mark lost leads
 */
export async function markLostLeads(workspaceId: string, inactiveDays: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    await sql`
      UPDATE customers
      SET is_lost = true, lost_at = NOW()
      WHERE workspace_id = ${workspaceId}
        AND is_lost = false
        AND last_contacted_at < ${cutoffDate.toISOString()}
        AND intent_score > 0.3
    `;
  } catch (error) {
    console.error('[Analytics] Failed to mark lost leads:', error);
  }
}

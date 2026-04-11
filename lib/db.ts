import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || '';

// Create SQL client - safely handle missing database
let sql: any;

try {
  if (databaseUrl) {
    sql = neon(databaseUrl);
  } else {
    // Mock function for when database isn't configured
    sql = (strings: any, ...values: any[]) => {
      console.warn('[DB] Database not configured - returning empty array');
      return Promise.resolve([]);
    };
  }
} catch (error) {
  console.error('[DB] Failed to initialize database client:', error);
  // Fallback to mock
  sql = (strings: any, ...values: any[]) => Promise.resolve([]);
}

export { sql };

let coreSchemaInitPromise: Promise<void> | null = null;

// Ensure minimum auth/workspace tables exist so login/register work on fresh DBs.
export async function ensureCoreSchema(): Promise<void> {
  if (!databaseUrl) return;
  if (coreSchemaInitPromise) return coreSchemaInitPromise;

  coreSchemaInitPromise = (async () => {
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    } catch {
      // Extension creation may be restricted; continue.
    }

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        company_name VARCHAR(255),
        avatar_url VARCHAR(500),
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'owner',
        subscription_tier VARCHAR(50) DEFAULT 'free',
        subscription_status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS auth_passwords (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        logo_url VARCHAR(500),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        nodes JSONB NOT NULL,
        edges JSONB NOT NULL,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        url VARCHAR(500) NOT NULL,
        name VARCHAR(255),
        size_bytes INTEGER,
        mime_type VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        whatsapp_status VARCHAR(50) DEFAULT 'not_contacted',
        last_contacted_at TIMESTAMP,
        tags TEXT[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, phone)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        direction VARCHAR(20) NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        content TEXT,
        media_url VARCHAR(500),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider VARCHAR(100) NOT NULL,
        event_type VARCHAR(100),
        payload JSONB NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS own_bsp_outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        channel VARCHAR(50) NOT NULL,
        recipient VARCHAR(100) NOT NULL,
        message TEXT,
        media_url VARCHAR(1000),
        message_type VARCHAR(50) DEFAULT 'text',
        payload JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'queued',
        provider_message_id VARCHAR(255),
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS broadcast_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        recipient_tag VARCHAR(100),
        status VARCHAR(50) DEFAULT 'sent',
        recipient_count INTEGER DEFAULT 0,
        schedule_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS workflow_wait_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        node_id UUID NOT NULL,
        phone VARCHAR(30) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_workflow_wait_states_lookup
      ON workflow_wait_states(workspace_id, phone, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        phone VARCHAR(30),
        trigger_source VARCHAR(50) NOT NULL DEFAULT 'manual',
        status VARCHAR(50) NOT NULL DEFAULT 'started',
        executed_nodes INTEGER DEFAULT 0,
        summary TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_lookup
      ON workflow_execution_logs(workspace_id, workflow_id, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inbound_event_dedup (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider VARCHAR(100) NOT NULL,
        external_message_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, provider, external_message_id, event_type)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_inbound_event_dedup_lookup
      ON inbound_event_dedup(workspace_id, provider, external_message_id, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_workspace_user
      ON push_subscriptions(workspace_id, user_id, updated_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS meta_apps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        app_id VARCHAR(255) NOT NULL,
        app_secret VARCHAR(255),
        config_id VARCHAR(255),
        redirect_uri VARCHAR(1000),
        business_id VARCHAR(255),
        webhook_verify_token VARCHAR(255),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, app_id)
      )
    `;

    await sql`
      ALTER TABLE meta_apps
      ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id VARCHAR(255)
    `;
    await sql`
      ALTER TABLE meta_apps
      ADD COLUMN IF NOT EXISTS whatsapp_access_token VARCHAR(2000)
    `;
    await sql`
      ALTER TABLE meta_apps
      ADD COLUMN IF NOT EXISTS instagram_business_account_id VARCHAR(255)
    `;
    await sql`
      ALTER TABLE meta_apps
      ADD COLUMN IF NOT EXISTS instagram_access_token VARCHAR(2000)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_meta_apps_workspace_id
      ON meta_apps(workspace_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        language VARCHAR(50) DEFAULT 'en_US',
        category VARCHAR(100) DEFAULT 'MARKETING',
        components JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'APPROVED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS appointment_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        phone VARCHAR(30),
        flow_token VARCHAR(255),
        flow_id VARCHAR(255),
        booking_date VARCHAR(100),
        booking_time VARCHAR(100),
        service VARCHAR(255),
        assignee VARCHAR(255),
        status VARCHAR(50) DEFAULT 'booked',
        notes TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_appointment_bookings_workspace_phone
      ON appointment_bookings(workspace_id, phone, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_flows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        flow_type VARCHAR(50) DEFAULT 'appointment',
        cta_label VARCHAR(60) DEFAULT 'Book Now',
        meta_flow_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        config JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_workspace_updated
      ON whatsapp_flows(workspace_id, updated_at DESC)
    `;

    // ===== ANALYTICS SCHEMA EXTENSIONS =====

    // Add analytics columns to messages table
    try {
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20)`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2)`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent VARCHAR(50)`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent_confidence DECIMAL(3,2)`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS keywords TEXT[]`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_id UUID`;
    } catch {
      // Columns might already exist
    }

    // Create indexes for messages analytics
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON messages(sentiment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(intent)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_has_image ON messages(has_image)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_workspace_sent ON messages(workspace_id, sent_at DESC)`;

    // Add analytics columns to customers table
    try {
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(50)`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS intent_score DECIMAL(3,2) DEFAULT 0`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_response_time INTEGER`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_tags TEXT[] DEFAULT '{}'`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP`;
    } catch {
      // Columns might already exist
    }

    // Create indexes for customers analytics
    await sql`CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(customer_segment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customers_intent_score ON customers(intent_score DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customers_lifetime_value ON customers(lifetime_value DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customers_is_lost ON customers(is_lost)`;

    // Keyword frequency tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS keyword_frequency (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        keyword VARCHAR(100) NOT NULL,
        frequency INTEGER DEFAULT 1,
        product_type VARCHAR(100),
        sentiment VARCHAR(20),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, keyword)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_keyword_frequency_workspace ON keyword_frequency(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_keyword_frequency_product ON keyword_frequency(workspace_id, product_type)`;

    // Customer insights table
    await sql`
      CREATE TABLE IF NOT EXISTS customer_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        total_messages INTEGER DEFAULT 0,
        response_rate DECIMAL(5,2) DEFAULT 0,
        avg_response_time INTEGER,
        conversation_summary TEXT,
        buying_signals_count INTEGER DEFAULT 0,
        objections_count INTEGER DEFAULT 0,
        interested_products TEXT[],
        price_sensitivity VARCHAR(50),
        last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_customer_insights_customer ON customer_insights(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customer_insights_workspace ON customer_insights(workspace_id)`;

    // Sales funnel events table
    await sql`
      CREATE TABLE IF NOT EXISTS sales_funnel_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        stage VARCHAR(50) NOT NULL,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_sales_funnel_customer ON sales_funnel_events(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sales_funnel_workspace ON sales_funnel_events(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sales_funnel_stage ON sales_funnel_events(stage)`;

    // Product demand table
    await sql`
      CREATE TABLE IF NOT EXISTS product_demand (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_name VARCHAR(255) NOT NULL,
        mention_count INTEGER DEFAULT 1,
        inquiry_count INTEGER DEFAULT 0,
        conversion_count INTEGER DEFAULT 0,
        revenue DECIMAL(12,2) DEFAULT 0,
        last_mentioned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        trend VARCHAR(20),
        UNIQUE(workspace_id, product_name)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_product_demand_workspace ON product_demand(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_product_demand_mention_count ON product_demand(mention_count DESC)`;

    // Analytics alerts table
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        threshold_value DECIMAL(10,2),
        triggered_count INTEGER DEFAULT 0,
        last_triggered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_alerts_workspace ON analytics_alerts(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_alerts_type ON analytics_alerts(alert_type)`;

    // Daily metrics aggregation table
    await sql`
      CREATE TABLE IF NOT EXISTS daily_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        metric_date DATE NOT NULL,
        total_messages INTEGER DEFAULT 0,
        incoming_messages INTEGER DEFAULT 0,
        outgoing_messages INTEGER DEFAULT 0,
        unique_customers INTEGER DEFAULT 0,
        avg_sentiment DECIMAL(3,2),
        hot_leads_count INTEGER DEFAULT 0,
        warm_leads_count INTEGER DEFAULT 0,
        cold_leads_count INTEGER DEFAULT 0,
        lost_leads_count INTEGER DEFAULT 0,
        avg_response_time_seconds INTEGER,
        total_revenue DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, metric_date)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_daily_metrics_workspace_date ON daily_metrics(workspace_id, metric_date DESC)`;

    // Staff performance table
    await sql`
      CREATE TABLE IF NOT EXISTS staff_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        staff_id UUID NOT NULL,
        metric_date DATE NOT NULL,
        chats_handled INTEGER DEFAULT 0,
        messages_sent INTEGER DEFAULT 0,
        avg_response_time_seconds INTEGER,
        first_response_time_seconds INTEGER,
        customer_satisfaction_score DECIMAL(3,2),
        conversions INTEGER DEFAULT 0,
        conversion_value DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, staff_id, metric_date)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_staff_performance_workspace ON staff_performance(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_staff_performance_staff_date ON staff_performance(staff_id, metric_date DESC)`;

    // Scheduled messages table
    await sql`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id)
      )
    `;

    // Create indexes for scheduled messages
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace_status_time ON scheduled_messages(workspace_id, status, scheduled_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_customer ON scheduled_messages(customer_id, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace_created ON scheduled_messages(workspace_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages(scheduled_at) WHERE status = 'pending'`;

    // Add last_user_message_at column to customers table if it doesn't exist
    try {
      await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMP`;
    } catch {
      // Column might already exist
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_customers_last_user_message ON customers(last_user_message_at DESC)`;
  })();

  return coreSchemaInitPromise;
}

// Type definitions for common operations
export interface User {
  id: string;
  email: string;
  name?: string;
  company_name?: string;
  avatar_url?: string;
  phone?: string;
  role: string;
  subscription_tier: string;
  subscription_status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  workspace_id: string;
  phone: string;
  name?: string;
  email?: string;
  whatsapp_status: string;
  last_contacted_at?: Date;
  tags: string[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  nodes: any[];
  edges: any[];
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  workspace_id: string;
  customer_id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  content?: string;
  media_url?: string;
  sent_at: Date;
  read_at?: Date;
}

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
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        credentials JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

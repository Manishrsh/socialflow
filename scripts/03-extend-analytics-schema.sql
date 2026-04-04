-- ===================================================================
-- Analytics Schema Extensions
-- Adds sentiment analysis, intent detection, keywords, and more
-- ===================================================================

-- Extend messages table with NLP and analytics fields
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent_confidence DECIMAL(3,2);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_id UUID;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON messages(sentiment);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(intent);
CREATE INDEX IF NOT EXISTS idx_messages_has_image ON messages(has_image);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_sent ON messages(workspace_id, sent_at DESC);

-- Extend customers table with segmentation and value tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS intent_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_response_time INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_tags TEXT[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP;

-- Create indexes for customer analytics
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(customer_segment);
CREATE INDEX IF NOT EXISTS idx_customers_intent_score ON customers(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_customers_lifetime_value ON customers(lifetime_value DESC);
CREATE INDEX IF NOT EXISTS idx_customers_is_lost ON customers(is_lost);

-- Keyword frequency tracking table
CREATE TABLE IF NOT EXISTS keyword_frequency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  keyword VARCHAR(100) NOT NULL,
  frequency INTEGER DEFAULT 1,
  product_type VARCHAR(100),
  sentiment VARCHAR(20),
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keyword_frequency_workspace ON keyword_frequency(workspace_id);
CREATE INDEX IF NOT EXISTS idx_keyword_frequency_product ON keyword_frequency(workspace_id, product_type);

-- Customer insights and conversation summaries
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
);

CREATE INDEX IF NOT EXISTS idx_customer_insights_customer ON customer_insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_insights_workspace ON customer_insights(workspace_id);

-- Sales funnel tracking
CREATE TABLE IF NOT EXISTS sales_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sales_funnel_customer ON sales_funnel_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_funnel_workspace ON sales_funnel_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sales_funnel_stage ON sales_funnel_events(stage);

-- Product demand tracking
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
);

CREATE INDEX IF NOT EXISTS idx_product_demand_workspace ON product_demand(workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_demand_mention_count ON product_demand(mention_count DESC);

-- Analytics alerts configuration and log
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
);

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_workspace ON analytics_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_alerts_type ON analytics_alerts(alert_type);

-- Daily aggregated metrics for performance
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
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_workspace_date ON daily_metrics(workspace_id, metric_date DESC);

-- Staff performance tracking
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
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_workspace ON staff_performance(workspace_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff_date ON staff_performance(staff_id, metric_date DESC);

-- Grant staff_id foreign key constraint
ALTER TABLE messages ADD CONSTRAINT fk_messages_staff_id 
FOREIGN KEY (staff_id) REFERENCES workspace_members(user_id) ON DELETE SET NULL;

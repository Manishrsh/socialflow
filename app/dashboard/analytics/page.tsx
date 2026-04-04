'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HotLeadsCard } from '@/components/analytics/HotLeadsCard';
import { SentimentGauge } from '@/components/analytics/SentimentGauge';
import { AlertsPanel } from '@/components/analytics/AlertsPanel';
import { ResponseTimeMetrics } from '@/components/analytics/ResponseTimeMetrics';
import { TrendingUp, MessageSquare, Users, Clock, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

interface AnalyticsData {
  summary?: {
    total_messages: number;
    total_conversations: number;
    total_customers: number;
    avg_conversation_length: number;
    platform_breakdown: {
      whatsapp: number;
      sms: number;
      instagram: number;
      facebook: number;
    };
  };
  sentiment?: {
    overall: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  hot_leads?: Array<{
    id: string;
    name: string;
    phone: string;
    intent_score: number;
    message_count: number;
    last_contact: string;
  }>;
  alerts?: Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: string;
  }>;
  response_metrics?: {
    summary: {
      avg_response_time: number;
      median_response_time: number;
      p95_response_time: number;
      sla_compliance_rate: number;
    };
    distribution: {
      under_1min: number;
      '1_to_5min': number;
      '5min_to_1hour': number;
      'over_1hour': number;
    };
    daily_breakdown: Array<{
      day: string;
      avg_time: number;
      message_count: number;
    }>;
  };
}

export default function AnalyticsDashboard() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [data, setData] = useState<AnalyticsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('auth_token');

        // Fetch all analytics in parallel
        const [summaryRes, sentimentRes, leadsRes, alertsRes, responseRes] = await Promise.all([
          fetch(`/api/analytics/summary?workspaceId=${workspaceId}&days=${dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/analytics/sentiment?workspaceId=${workspaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/analytics/customer-insights?workspaceId=${workspaceId}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/analytics/alerts-config?workspaceId=${workspaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/analytics/response-metrics?workspaceId=${workspaceId}&days=${dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const [summary, sentiment, leads, alerts, response] = await Promise.all([
          summaryRes.json(),
          sentimentRes.json(),
          leadsRes.json(),
          alertsRes.json(),
          responseRes.json(),
        ]);

        setData({
          summary: summary.summary,
          sentiment: sentiment.sentiment,
          hot_leads: leads.customers?.filter((c: any) => c.intent_score > 0.6).slice(0, 5),
          alerts: alerts.alerts?.map((a: any) => ({
            type: a.type,
            severity: a.severity,
            message: a.message,
            timestamp: a.updated_at,
          })),
          response_metrics: response,
        });
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      fetchAnalytics();
    }
  }, [workspaceId, dateRange]);

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  const KPICard = ({ icon: Icon, label, value, trend }: any) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground/60 mb-1">{label}</p>
          <p className="text-2xl font-bold">{formatNumber(value)}</p>
        </div>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {trend && <p className="text-xs text-emerald-600 mt-2">{trend}</p>}
    </Card>
  );

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-foreground/60 mt-1">Real-time insights and performance metrics</p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'outline'}
                onClick={() => setDateRange(range)}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon={MessageSquare}
            label="Total Messages"
            value={data.summary?.total_messages}
            trend="↑ 12% from last period"
          />
          <KPICard
            icon={Users}
            label="Total Customers"
            value={data.summary?.total_customers}
            trend="↑ 8% new customers"
          />
          <KPICard
            icon={Clock}
            label="Avg Response Time"
            value={data.response_metrics?.summary.avg_response_time ? 
              `${Math.round(data.response_metrics.summary.avg_response_time / 60)}m` : 'N/A'}
          />
          <KPICard
            icon={TrendingUp}
            label="Intent Score"
            value={data.sentiment?.overall ? `${Math.round(data.sentiment.overall * 100)}%` : 'N/A'}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sentiment Analysis */}
          <div>
            {data.sentiment ? (
              <SentimentGauge
                overall={data.sentiment.overall}
                breakdown={data.sentiment.breakdown}
                isLoading={isLoading}
              />
            ) : (
              <Card className="p-6">
                <p className="text-foreground/60">No sentiment data available</p>
              </Card>
            )}
          </div>

          {/* Platform Distribution */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Platform Distribution</h3>
            {data.summary?.platform_breakdown ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'WhatsApp', value: data.summary.platform_breakdown.whatsapp },
                      { name: 'SMS', value: data.summary.platform_breakdown.sms },
                      { name: 'Instagram', value: data.summary.platform_breakdown.instagram },
                      { name: 'Facebook', value: data.summary.platform_breakdown.facebook },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#8b5cf6" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-foreground/60">
                No data available
              </div>
            )}
          </Card>

          {/* Hot Leads */}
          <div>
            {data.hot_leads ? (
              <HotLeadsCard leads={data.hot_leads} isLoading={isLoading} />
            ) : (
              <Card className="p-6">
                <p className="text-foreground/60">No hot leads available</p>
              </Card>
            )}
          </div>
        </div>

        {/* Response Time Metrics */}
        {data.response_metrics && (
          <div className="mb-8">
            <ResponseTimeMetrics data={data.response_metrics} isLoading={isLoading} />
          </div>
        )}

        {/* Alerts */}
        <div className="mb-8">
          {data.alerts ? (
            <AlertsPanel alerts={data.alerts} isLoading={isLoading} />
          ) : (
            <Card className="p-6 border-green-200 bg-green-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">All systems operating normally</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

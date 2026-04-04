'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Eye,
  Target,
  Users,
  DollarSign,
  Clock,
  Zap,
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdvancedAnalyticsPage() {
  const { workspace } = useAuth();
  const [dateRange, setDateRange] = useState('30');

  // Fetch all analytics data
  const { data: keywords } = useSWR(
    workspace ? `/api/analytics/keywords?workspaceId=${workspace.id}&limit=15` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: sentiment } = useSWR(
    workspace ? `/api/analytics/sentiment?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: funnel } = useSWR(
    workspace ? `/api/analytics/sales-funnel?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: productDemand } = useSWR(
    workspace ? `/api/analytics/product-demand?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: lostLeads } = useSWR(
    workspace ? `/api/analytics/lost-leads?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: staffPerformance } = useSWR(
    workspace ? `/api/analytics/staff-performance?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: customerIntent } = useSWR(
    workspace ? `/api/analytics/customer-intent?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: alerts } = useSWR(
    workspace ? `/api/analytics/alerts?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 15000 }
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="mt-2 text-foreground/60">
            Deep insights into customer behavior, sales funnel, and business intelligence for {workspace?.name}.
          </p>
        </div>
        <div className="flex gap-2">
          {['7', '30', '90'].map((value) => (
            <Button
              key={value}
              variant={dateRange === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(value)}
            >
              {value}D
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.alerts && alerts.alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Active Alerts ({alerts.summary.total_alerts})</h3>
              <div className="mt-3 space-y-2">
                {alerts.alerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={i} className="text-sm text-amber-800">
                    <span className="font-medium">{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Overall Sentiment */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-foreground/60">Overall Sentiment</p>
              <p className="mt-2 text-3xl font-bold">{sentiment?.overall.toFixed(2) || '-'}</p>
              <p className="mt-1 text-xs text-foreground/60">0 = negative, 1 = positive</p>
            </div>
            <div className="text-2xl">{sentiment?.overall > 0.6 ? '😊' : sentiment?.overall > 0.4 ? '😐' : '😞'}</div>
          </div>
        </Card>

        {/* Customer Segments */}
        <Card className="p-6">
          <p className="text-sm text-foreground/60">Hot Leads</p>
          <p className="mt-2 text-3xl font-bold">{customerIntent?.segment_summary?.hot_leads_count || 0}</p>
          <p className="mt-1 text-xs text-foreground/60">Ready to convert</p>
        </Card>

        {/* Lost Revenue */}
        <Card className="p-6">
          <p className="text-sm text-foreground/60">Potential Lost Revenue</p>
          <p className="mt-2 text-3xl font-bold">${(lostLeads?.summary?.total_estimated_revenue_loss || 0) / 1000}K</p>
          <p className="mt-1 text-xs text-foreground/60">{lostLeads?.summary?.total_lost_leads || 0} lost leads</p>
        </Card>

        {/* Avg Response Time */}
        <Card className="p-6">
          <p className="text-sm text-foreground/60">Avg Response Time</p>
          <p className="mt-2 text-3xl font-bold">{staffPerformance?.summary?.avg_response_time_seconds || 0}s</p>
          <p className="mt-1 text-xs text-foreground/60">Team average</p>
        </Card>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Sentiment Breakdown */}
        {sentiment && (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Sentiment Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={[
                  { name: 'Positive', value: sentiment.breakdown.positive },
                  { name: 'Neutral', value: sentiment.breakdown.neutral },
                  { name: 'Negative', value: sentiment.breakdown.negative },
                ]} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  <Cell fill="#10b981" />
                  <Cell fill="#6b7280" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Sales Funnel */}
        {funnel && (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Sales Funnel</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { stage: 'Inquiry', count: funnel.funnel.inquiry },
                { stage: 'Discussion', count: funnel.funnel.discussion },
                { stage: 'Purchase', count: funnel.funnel.purchase },
                { stage: 'Complete', count: funnel.funnel.completion },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-foreground/60">Inquiry → Discussion</p>
                <p className="text-lg font-bold">{funnel.conversions.inquiry_to_discussion.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-foreground/60">Overall Conversion</p>
                <p className="text-lg font-bold">{funnel.conversions.overall.toFixed(1)}%</p>
              </div>
            </div>
          </Card>
        )}

        {/* Top Keywords */}
        {keywords && (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Top Keywords</h3>
            <div className="space-y-3">
              {keywords.keywords.slice(0, 8).map((kw: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{kw.keyword}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, (kw.frequency / keywords.keywords[0].frequency) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground/60">{kw.frequency}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Product Demand */}
        {productDemand && (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Product Demand</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productDemand.products.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" angle={-45} height={80} interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="mentions" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Staff Performance */}
      {staffPerformance && staffPerformance.staff_metrics && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Staff Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Staff Member</th>
                  <th className="px-4 py-2 text-right">Chats</th>
                  <th className="px-4 py-2 text-right">Response Time</th>
                  <th className="px-4 py-2 text-right">Conversion Rate</th>
                  <th className="px-4 py-2 text-right">Satisfaction</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.staff_metrics.slice(0, 5).map((staff: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3">{staff.staff_name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-right font-medium">{staff.chats_handled}</td>
                    <td className="px-4 py-3 text-right">{Math.round(staff.avg_response_time_seconds / 60)}m</td>
                    <td className="px-4 py-3 text-right">{staff.conversion_rate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">{staff.customer_satisfaction.toFixed(1)}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lost Leads Opportunities */}
      {lostLeads && lostLeads.recovery_opportunities && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Recovery Opportunities
          </h3>
          <div className="space-y-3">
            {lostLeads.recovery_opportunities.slice(0, 5).map((lead: any, i: number) => (
              <div key={i} className="flex items-start justify-between border-b pb-3 last:border-b-0">
                <div>
                  <p className="font-medium">{lead.name || 'Unknown'}</p>
                  <p className="text-xs text-foreground/60">{lead.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">${lead.estimated_revenue_loss}</p>
                  <p className="text-xs text-foreground/60">{lead.days_inactive} days inactive</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer Intent Distribution */}
      {customerIntent && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Customer Intent Breakdown</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {customerIntent.intents.map((intent: any, i: number) => (
              <div key={i} className="rounded-lg border p-4">
                <p className="text-xs font-medium text-foreground/60 uppercase">{intent.intent}</p>
                <p className="mt-2 text-2xl font-bold">{intent.count}</p>
                <p className="mt-1 text-xs">
                  {intent.conversion_likelihood === 'high' ? '🔥' : intent.conversion_likelihood === 'medium' ? '⚡' : '❄️'} Conversion
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users, MessageSquare, Zap, TrendingUp } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AnalyticsSummary {
  summary: {
    totalCustomers: number;
    totalMessages: number;
    activeWorkflows: number;
    engagementRate: number;
    period: number;
  };
  messageTypes: Array<{ type: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const { workspace } = useAuth();
  const [period, setPeriod] = useState('30');

  const { data, isLoading } = useSWR(
    workspace ? `/api/analytics/summary?workspaceId=${workspace.id}&period=${period}` : null,
    fetcher
  );

  const analytics: AnalyticsSummary = data || {
    summary: { totalCustomers: 0, totalMessages: 0, activeWorkflows: 0, engagementRate: 0, period: 30 },
    messageTypes: [],
    trend: [],
  };

  const stats = [
    {
      label: 'Total Customers',
      value: analytics.summary.totalCustomers,
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-600',
    },
    {
      label: 'Messages',
      value: analytics.summary.totalMessages,
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'text-green-600',
    },
    {
      label: 'Active Workflows',
      value: analytics.summary.activeWorkflows,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-amber-600',
    },
    {
      label: 'Engagement Rate',
      value: `${analytics.summary.engagementRate}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-purple-600',
    },
  ];

  const trendData = analytics.trend.slice(-7).reverse();
  const messageTypeData = analytics.messageTypes;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-foreground/60 mt-2">Track your WhatsApp automation performance</p>
        </div>
        <div className="flex gap-2">
          {['7', '30', '90'].map((value) => (
            <Button
              key={value}
              variant={period === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(value)}
            >
              {value === '7' ? '7D' : value === '30' ? '30D' : '90D'}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className={stat.color}>{stat.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Message Trend */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Message Trend (Last 7 Days)</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-foreground/60">
              Loading...
            </div>
          ) : trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  stroke="currentColor"
                  style={{ fontSize: '0.875rem' }}
                />
                <YAxis stroke="currentColor" style={{ fontSize: '0.875rem' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-foreground/60">
              No data available
            </div>
          )}
        </Card>

        {/* Message Types */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Message Types</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-foreground/60">
              Loading...
            </div>
          ) : messageTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={messageTypeData}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {messageTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-foreground/60">
              No data available
            </div>
          )}
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Performance</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Response Time</span>
              <span className="font-semibold">{"< 1 second"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Message Delivery Rate</span>
              <span className="font-semibold">{'99.8%'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Avg Messages per Customer</span>
              <span className="font-semibold">
                {analytics.summary.totalCustomers > 0
                  ? (analytics.summary.totalMessages / analytics.summary.totalCustomers).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Workflow Success Rate</span>
              <span className="font-semibold">{'98.5%'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Top Activities</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <p className="text-sm font-medium">Most Common Messages</p>
                <p className="text-xs text-foreground/60">Inquiry</p>
              </div>
              <span className="text-sm font-semibold">{'45%'}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <p className="text-sm font-medium">Most Used Workflow</p>
                <p className="text-xs text-foreground/60">Welcome Sequence</p>
              </div>
              <span className="text-sm font-semibold">{'324 executions'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Peak Activity Time</p>
                <p className="text-xs text-foreground/60">10:00 AM - 12:00 PM</p>
              </div>
              <span className="text-sm font-semibold">{'Weekdays'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <Card className="p-6 bg-blue-500/10 border border-blue-200/20">
        <h2 className="font-semibold mb-3">Insights & Recommendations</h2>
        <ul className="space-y-2 text-sm text-foreground/80">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">-</span>
            <span>Your engagement rate is above average. Consider creating more targeted campaigns for inactive customers.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">-</span>
            <span>Peak activity occurs in the morning. Schedule broadcasts at 9-10 AM for maximum engagement.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">-</span>
            <span>Text messages dominate (85%). Consider adding image content to increase engagement.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}


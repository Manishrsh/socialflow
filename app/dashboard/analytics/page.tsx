'use client';

import { useState } from 'react';
import Link from 'next/link';
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
} from 'recharts';
import {
  Users,
  MessageSquare,
  Zap,
  TrendingUp,
  Webhook,
  Send,
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load analytics');
  }
  return data;
};

interface AnalyticsSummary {
  summary: {
    workspaceName: string;
    totalCustomers: number;
    totalMessages: number;
    incomingMessages: number;
    outgoingMessages: number;
    activeCustomers: number;
    activeWorkflows: number;
    webhookEvents: number;
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    webhookRuns: number;
    engagementRate: number;
    workflowSuccessRate: number;
    deliveryRate: number;
    avgMessagesPerCustomer: number;
    period: number;
    peakHour: string | null;
  };
  trend: Array<{ date: string; messages: number; inbound: number }>;
  messageTypes: Array<{ type: string; count: number }>;
  outboxStatuses: Array<{ status: string; count: number }>;
  topWorkflows: Array<{ workflowId: string; name: string; runs: number; completedRuns: number }>;
  channels: Array<{ source: string; count: number }>;
}

const COLORS = ['#111827', '#0f766e', '#f59e0b', '#dc2626', '#2563eb', '#7c3aed'];

export default function AnalyticsPage() {
  const { workspace } = useAuth();
  const [period, setPeriod] = useState('30');

  const { data, error, isLoading } = useSWR<AnalyticsSummary>(
    workspace ? `/api/analytics/summary?workspaceId=${workspace.id}&period=${period}` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  );

  const analytics = data;
  const stats = analytics
    ? [
        {
          label: 'Customers',
          value: analytics.summary.totalCustomers,
          note: `${analytics.summary.activeCustomers} active in ${analytics.summary.period} days`,
          icon: <Users className="w-5 h-5" />,
          color: 'text-sky-600',
        },
        {
          label: 'Messages',
          value: analytics.summary.totalMessages,
          note: `${analytics.summary.incomingMessages} inbound / ${analytics.summary.outgoingMessages} outbound`,
          icon: <MessageSquare className="w-5 h-5" />,
          color: 'text-emerald-600',
        },
        {
          label: 'Workflow Runs',
          value: analytics.summary.totalRuns,
          note: `${analytics.summary.workflowSuccessRate}% success rate`,
          icon: <Zap className="w-5 h-5" />,
          color: 'text-amber-600',
        },
        {
          label: 'Webhook Events',
          value: analytics.summary.webhookEvents,
          note: `${analytics.summary.webhookRuns} webhook-triggered runs`,
          icon: <Webhook className="w-5 h-5" />,
          color: 'text-violet-600',
        },
      ]
    : [];

  const insightItems = analytics
    ? [
        analytics.summary.engagementRate >= 50
          ? `Customer engagement is strong at ${analytics.summary.engagementRate}%. Keep the main menu and repeat-entry flows short.`
          : `Engagement is ${analytics.summary.engagementRate}%. Add stronger first replies or richer product options to improve response rate.`,
        analytics.summary.failedRuns > 0
          ? `${analytics.summary.failedRuns} workflow runs failed in the selected period. Check Execution Logs for the recurring failure reasons.`
          : 'No workflow failures in the selected period. Current automation is stable.',
        analytics.summary.peakHour
          ? `Peak message activity is around ${analytics.summary.peakHour}. Schedule broadcasts slightly before that window.`
          : 'Peak message time is not available yet because message volume is still low.',
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-foreground/60">
            Real customer, workflow, delivery, and webhook activity for {workspace?.name || 'your workspace'}.
          </p>
        </div>
        <div className="flex gap-2">
          {['7', '30', '90'].map((value) => (
            <Button
              key={value}
              variant={period === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(value)}
            >
              {value}D
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-destructive">
          {error.message}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(isLoading ? Array.from({ length: 4 }) : stats).map((stat: any, index) => (
          <Card key={stat?.label || index} className="p-6">
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground/60">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold">{stat.value}</p>
                  <p className="mt-2 text-xs text-foreground/60">{stat.note}</p>
                </div>
                <div className={stat.color}>{stat.icon}</div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Message Volume Trend</h2>
              <p className="text-sm text-foreground/60">Inbound vs total messages over the selected period.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="flex h-80 items-center justify-center text-foreground/60">Loading...</div>
          ) : analytics && analytics.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="currentColor" style={{ fontSize: '0.8rem' }} />
                <YAxis stroke="currentColor" style={{ fontSize: '0.8rem' }} />
                <Tooltip />
                <Line type="monotone" dataKey="messages" stroke="#111827" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="inbound" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-80 items-center justify-center text-foreground/60">No message activity yet.</div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Message Types</h2>
          {isLoading ? (
            <div className="flex h-80 items-center justify-center text-foreground/60">Loading...</div>
          ) : analytics && analytics.messageTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={analytics.messageTypes}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {analytics.messageTypes.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-80 items-center justify-center text-foreground/60">No message type data yet.</div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Operational Health</h2>
          {isLoading || !analytics ? (
            <div className="text-foreground/60">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/60">Delivery Rate</span>
                <span className="font-semibold">{analytics.summary.deliveryRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/60">Workflow Success Rate</span>
                <span className="font-semibold">{analytics.summary.workflowSuccessRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/60">Avg Messages per Customer</span>
                <span className="font-semibold">{analytics.summary.avgMessagesPerCustomer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/60">Peak Hour</span>
                <span className="font-semibold">{analytics.summary.peakHour || 'No data yet'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/60">Active Workflows</span>
                <span className="font-semibold">{analytics.summary.activeWorkflows}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Outbox Status</h2>
          {isLoading ? (
            <div className="text-foreground/60">Loading...</div>
          ) : analytics && analytics.outboxStatuses.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.outboxStatuses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke="currentColor" style={{ fontSize: '0.75rem' }} />
                <YAxis stroke="currentColor" style={{ fontSize: '0.75rem' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-foreground/60">No outbox data yet.</div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Top Workflows</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/execution-logs">Open Logs</Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="text-foreground/60">Loading...</div>
          ) : analytics && analytics.topWorkflows.length > 0 ? (
            <div className="space-y-3">
              {analytics.topWorkflows.map((workflow) => (
                <div key={workflow.workflowId} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{workflow.name}</p>
                    <p className="text-xs text-foreground/60">{workflow.completedRuns} completed runs</p>
                  </div>
                  <div className="text-sm font-semibold">{workflow.runs}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-foreground/60">No workflow runs yet.</div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-4 w-4" />
            <h2 className="font-semibold">Customer Channels</h2>
          </div>
          {isLoading ? (
            <div className="text-foreground/60">Loading...</div>
          ) : analytics && analytics.channels.length > 0 ? (
            <div className="space-y-3">
              {analytics.channels.map((channel) => (
                <div key={channel.source} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="capitalize">{channel.source}</span>
                  <span className="font-semibold">{channel.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-foreground/60">No channel data yet.</div>
          )}
        </Card>
      </div>

      <Card className="border border-border p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <h2 className="font-semibold">Recommendations</h2>
        </div>
        {isLoading ? (
          <div className="text-foreground/60">Loading...</div>
        ) : (
          <div className="space-y-3 text-sm text-foreground/80">
            {insightItems.map((item) => (
              <div key={item} className="rounded-lg bg-muted/50 p-3">
                {item}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

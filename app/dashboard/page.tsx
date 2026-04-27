'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEVICE_HOME_SCREEN_KEY } from '@/lib/device-preferences';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  MessageSquare,
  Send,
  Users,
  Webhook,
  Zap,
} from 'lucide-react';

interface AnalyticsSummaryResponse {
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
  channels: Array<{ source: string; count: number }>;
  topWorkflows: Array<{ workflowId: string; name: string; runs: number; completedRuns: number }>;
}

interface ExecutionLog {
  id: string;
  workflow_id: string;
  workflow_name: string;
  phone: string | null;
  trigger_source: string;
  status: string;
  executed_nodes: number;
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface CalendarPostsResponse {
  upcomingPosts: Array<{
    id: string;
    eventName: string;
    eventDate: string;
    status: string;
    scheduledFor: string | null;
    postedAt: string | null;
    engagementStatus: string;
  }>;
  pastPosts: Array<{
    id: string;
    eventName: string;
    eventDate: string;
    status: string;
    postedAt: string | null;
    engagementStatus: string;
  }>;
  engagementStatus: {
    total: number;
    posted: number;
    failed: number;
    scheduled: number;
  };
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function formatLogTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { workspace } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preferredPath = window.localStorage.getItem(DEVICE_HOME_SCREEN_KEY) || '/dashboard';
    if (preferredPath && preferredPath !== '/dashboard') {
      router.replace(preferredPath);
    }
  }, [router]);

  const {
    data: analytics,
    error: analyticsError,
    isLoading: isAnalyticsLoading,
  } = useSWR<AnalyticsSummaryResponse>(
    workspace ? `/api/analytics/summary?workspaceId=${workspace.id}&period=30` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  );

  const {
    data: logsData,
    error: logsError,
    isLoading: isLogsLoading,
  } = useSWR<{ logs: ExecutionLog[] }>(
    workspace ? '/api/workflows/logs?limit=5' : null,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  );

  const {
    data: calendarData,
    error: calendarError,
    isLoading: isCalendarLoading,
  } = useSWR<CalendarPostsResponse>(
    workspace ? `/api/calendar/posts?workspaceId=${workspace.id}&limit=6` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  );

  const summary = analytics?.summary;
  const stats = summary
    ? [
        {
          label: 'Customers',
          value: formatNumber(summary.totalCustomers),
          note: `${formatNumber(summary.activeCustomers)} active in ${summary.period} days`,
          icon: <Users className="h-5 w-5" />,
          iconWrap: 'bg-sky-100 text-sky-700',
        },
        {
          label: 'Messages',
          value: formatNumber(summary.totalMessages),
          note: `${formatNumber(summary.incomingMessages)} inbound / ${formatNumber(summary.outgoingMessages)} outbound`,
          icon: <MessageSquare className="h-5 w-5" />,
          iconWrap: 'bg-emerald-100 text-emerald-700',
        },
        {
          label: 'Active Automations',
          value: formatNumber(summary.activeWorkflows),
          note: `${formatNumber(summary.totalRuns)} runs in ${summary.period} days`,
          icon: <Zap className="h-5 w-5" />,
          iconWrap: 'bg-amber-100 text-amber-700',
        },
        {
          label: 'Engagement Rate',
          value: `${summary.engagementRate}%`,
          note: `${summary.workflowSuccessRate}% workflow success`,
          icon: <BarChart3 className="h-5 w-5" />,
          iconWrap: 'bg-violet-100 text-violet-700',
        },
      ]
    : [];

  const quickActions = [
    {
      title: 'Create Automation',
      description: 'Build a new WhatsApp automation workflow',
      href: '/dashboard/automation',
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: 'Open Messages',
      description: 'Review live inbound and outbound chats',
      href: '/dashboard/messages',
      icon: <MessageSquare className="h-6 w-6" />,
    },
    {
      title: 'Send Broadcast',
      description: 'Launch a message campaign to customers',
      href: '/dashboard/broadcasts',
      icon: <Send className="h-6 w-6" />,
    },
    {
      title: 'Check Analytics',
      description: 'Dive deeper into delivery and engagement',
      href: '/dashboard/analytics',
      icon: <BarChart3 className="h-6 w-6" />,
    },
    {
      title: 'Open Calendar',
      description: 'Plan festivals, anniversary posts, and branded creatives',
      href: '/dashboard/calendar',
      icon: <CalendarDays className="h-6 w-6" />,
    },
  ];

  const recentLogs = logsData?.logs || [];
  const channels = analytics?.channels || [];
  const topWorkflows = analytics?.topWorkflows || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">{workspace?.name || 'Welcome to WareChat'}</h1>
          <p className="mt-2 text-foreground/60">
            Live workspace activity for the last {summary?.period || 30} days.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/analytics">
            Open Full Analytics <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {analyticsError ? (
        <Card className="p-4 text-sm text-destructive">{analyticsError.message}</Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(isAnalyticsLoading ? Array.from({ length: 4 }) : stats).map((stat: any, index) => (
          <Card key={stat?.label || index} className="overflow-hidden border-0 bg-gradient-to-br from-white to-muted/40 p-6 shadow-sm">
            {isAnalyticsLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-10 w-10 rounded-2xl bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-8 w-24 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.iconWrap}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm text-foreground/60">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-2 text-xs text-foreground/60">{stat.note}</p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Operations Snapshot</h2>
              <p className="text-sm text-foreground/60">Real platform health based on your current workspace data.</p>
            </div>
            <Webhook className="h-5 w-5 text-foreground/40" />
          </div>

          {isAnalyticsLoading || !summary ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-foreground/60">Delivery Rate</div>
                <div className="mt-2 text-2xl font-bold">{summary.deliveryRate}%</div>
                <div className="mt-2 text-xs text-foreground/60">Based on recent outbox delivery states.</div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-foreground/60">Workflow Success</div>
                <div className="mt-2 text-2xl font-bold">{summary.workflowSuccessRate}%</div>
                <div className="mt-2 text-xs text-foreground/60">{formatNumber(summary.completedRuns)} completed, {formatNumber(summary.failedRuns)} failed.</div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-foreground/60">Webhook Events</div>
                <div className="mt-2 text-2xl font-bold">{formatNumber(summary.webhookEvents)}</div>
                <div className="mt-2 text-xs text-foreground/60">{formatNumber(summary.webhookRuns)} workflow runs started by webhooks.</div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-foreground/60">Peak Messaging Hour</div>
                <div className="mt-2 text-2xl font-bold">{summary.peakHour || 'N/A'}</div>
                <div className="mt-2 text-xs text-foreground/60">Average {summary.avgMessagesPerCustomer} messages per customer.</div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Top Channels</h2>
          <p className="mt-1 text-sm text-foreground/60">Where your current customers are coming from.</p>

          <div className="mt-5 space-y-3">
            {isAnalyticsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : channels.length > 0 ? (
              channels.map((channel) => (
                <div key={channel.source} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                  <div>
                    <div className="font-medium capitalize">{channel.source}</div>
                    <div className="text-xs text-foreground/60">Connected customer records</div>
                  </div>
                  <div className="text-lg font-semibold">{formatNumber(channel.count)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">
                No customer channel data yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            <Zap className="h-5 w-5 text-foreground/40" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="h-full rounded-2xl border bg-background p-5 shadow-none transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{action.title}</h3>
                      <p className="mt-2 text-sm text-foreground/60">{action.description}</p>
                    </div>
                    <div className="text-primary/70">{action.icon}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Calendar Marketing</h2>
              <p className="text-sm text-foreground/60">Upcoming posts, past posts, and engagement status.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-foreground/40" />
          </div>

          {calendarError ? (
            <div className="rounded-2xl border p-4 text-sm text-destructive">{calendarError.message}</div>
          ) : isCalendarLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-xs text-foreground/60">Upcoming</div>
                  <div className="mt-2 text-2xl font-bold">{calendarData?.engagementStatus?.scheduled || 0}</div>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-xs text-foreground/60">Posted</div>
                  <div className="mt-2 text-2xl font-bold">{calendarData?.engagementStatus?.posted || 0}</div>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <div className="text-xs text-foreground/60">Failed</div>
                  <div className="mt-2 text-2xl font-bold">{calendarData?.engagementStatus?.failed || 0}</div>
                </div>
              </div>

              <div className="space-y-3">
                {(calendarData?.upcomingPosts || []).slice(0, 3).map((post) => (
                  <div key={post.id} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{post.eventName}</div>
                        <div className="text-xs text-foreground/60">{new Date(post.eventDate).toLocaleDateString()}</div>
                      </div>
                      <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{post.status}</div>
                    </div>
                    <div className="mt-2 text-xs text-foreground/60">Engagement: {post.engagementStatus}</div>
                  </div>
                ))}
                {!calendarData?.upcomingPosts?.length ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">
                    No calendar posts scheduled yet.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent Workflow Activity</h2>
              <p className="text-sm text-foreground/60">Latest live executions across your workspace.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/execution-logs">View All</Link>
            </Button>
          </div>

          <div className="space-y-3">
            {isLogsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : logsError ? (
              <div className="rounded-2xl border p-4 text-sm text-destructive">{logsError.message}</div>
            ) : recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{log.workflow_name || 'Workflow run'}</div>
                      <div className="mt-1 text-xs text-foreground/60">{formatLogTime(log.created_at)}</div>
                    </div>
                    <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">
                      {log.status === 'ignored_duplicate' ? 'ignored duplicate' : log.status}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-foreground/75">{log.summary || 'No summary available.'}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">
                No workflow runs yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Top Workflows</h2>
          <p className="mt-1 text-sm text-foreground/60">Most active automations over the last {summary?.period || 30} days.</p>

          <div className="mt-5 space-y-3">
            {isAnalyticsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : topWorkflows.length > 0 ? (
              topWorkflows.map((workflow) => (
                <div key={workflow.workflowId} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{workflow.name}</div>
                    <div className="text-xs text-foreground/60">{formatNumber(workflow.completedRuns)} completed runs</div>
                  </div>
                  <div className="text-lg font-semibold">{formatNumber(workflow.runs)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">
                No workflow activity yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 via-background to-emerald-50 p-6">
          <h2 className="text-2xl font-bold">Live Dashboard, Real Workspace Data</h2>
          <p className="mt-3 max-w-xl text-sm text-foreground/70">
            This dashboard now pulls actual customer, message, workflow, delivery, and webhook metrics from your workspace instead of static placeholders.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/messages">
                Open Inbox <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">View Customers</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

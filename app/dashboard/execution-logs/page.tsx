'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load execution logs');
  }
  return data;
};

export default function ExecutionLogsPage() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  const logsUrl = workflowId
    ? `/api/workflows/logs?workflowId=${encodeURIComponent(workflowId)}&limit=50`
    : '/api/workflows/logs?limit=50';
  const { data, error, isLoading, mutate } = useSWR<{ logs: ExecutionLog[] }>(logsUrl, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 0,
  });
  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Execution Logs</h1>
          <p className="text-sm text-foreground/60">
            Background webhook runs and manual workflow executions update here automatically.
          </p>
        </div>
        <div className="flex gap-2">
          {workflowId ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/execution-logs">Show All Logs</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
        </div>
      </div>

      {workflowId ? (
        <Card className="p-4 text-sm text-foreground/70">
          Filtered to workflow <span className="font-medium">{workflowId}</span>.
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="p-4 text-sm text-foreground/60">Loading execution logs...</Card>
      ) : error ? (
        <Card className="p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load execution logs'}
        </Card>
      ) : logs.length === 0 ? (
        <Card className="p-4 text-sm text-foreground/60">No workflow logs yet.</Card>
      ) : (
        <div className="space-y-3">
          {logs.map((item) => (
            <Card key={item.id} className="p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {item.status === 'ignored_duplicate' ? 'ignored duplicate' : item.status}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{item.trigger_source}</span>
                  <span className="text-xs text-foreground/60">{item.executed_nodes || 0} nodes</span>
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link href={`/dashboard/automation/${item.workflow_id}`}>
                      {item.workflow_name || item.workflow_id}
                    </Link>
                  </Button>
                </div>
                <div className="text-xs text-foreground/60">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>

              <div className="text-sm">{item.summary || 'No summary'}</div>

              {item.phone ? (
                <div className="text-xs text-foreground/60">Phone: {item.phone}</div>
              ) : null}

              <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(item.details || {}, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface OutboxItem {
  id: string;
  channel: string;
  recipient: string;
  message: string | null;
  media_url: string | null;
  message_type: string;
  payload: Record<string, any>;
  status: string;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export default function OutboxPage() {
  const { workspace } = useAuth();
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const statusQ = status === 'all' ? '' : `&status=${encodeURIComponent(status)}`;
  const channelQ = channel === 'all' ? '' : `&channel=${encodeURIComponent(channel)}`;
  const searchQ = q ? `&q=${encodeURIComponent(q)}` : '';

  const { data, isLoading, mutate } = useSWR(
    workspace
      ? `/api/outbox?workspaceId=${workspace.id}&page=${page}&limit=25${statusQ}${channelQ}${searchQ}`
      : null,
    fetcher
  );

  const items: OutboxItem[] = data?.items || [];
  const totalPages = Number(data?.totalPages || 1);

  const retryItem = async (id: string) => {
    if (!workspace?.id) return;
    const res = await fetch(`/api/outbox/${id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload?.error || 'Retry failed');
      return;
    }
    mutate();
  };

  const processItem = async (id: string) => {
    if (!workspace?.id) return;
    const res = await fetch(`/api/outbox/${id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload?.error || 'Process failed');
      return;
    }
    mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Outbox Monitor</h1>
        <p className="text-foreground/60 mt-2">Track queued, sent, and failed messages for Own BSP.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search recipient/message/error..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-background"
          >
            <option value="all">All Status</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-background"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
          </select>
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-foreground/60">Loading outbox...</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-foreground/60">No outbox items found.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{item.channel}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">{item.status}</span>
                  <span className="text-xs text-foreground/60">{item.message_type}</span>
                </div>
                <div className="text-xs text-foreground/60">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>

              <div className="text-sm">
                <span className="text-foreground/60">To:</span> {item.recipient}
              </div>

              {item.message && (
                <div className="text-sm">
                  <span className="text-foreground/60">Message:</span> {item.message}
                </div>
              )}

              {item.media_url && (
                <div className="text-sm break-all">
                  <span className="text-foreground/60">Media:</span> {item.media_url}
                </div>
              )}

              {item.error && (
                <div className="text-sm text-red-600">
                  <span className="font-medium">Error:</span> {item.error}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {item.status === 'queued' && (
                  <Button size="sm" variant="outline" onClick={() => processItem(item.id)}>
                    Process
                  </Button>
                )}
                {item.status === 'failed' && (
                  <Button size="sm" variant="outline" onClick={() => retryItem(item.id)}>
                    Retry
                  </Button>
                )}
                <span className="text-xs text-foreground/50">{item.id}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <div className="text-sm text-foreground/60">
          Page {page} / {totalPages}
        </div>
        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

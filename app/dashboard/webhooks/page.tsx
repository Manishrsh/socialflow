'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to load webhook events');
  }
  return data;
};

export default function WebhookHistoryPage() {
  const { workspace } = useAuth();
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(1);

  const query = workspace
    ? `/api/webhooks/events?workspaceId=${workspace.id}&provider=${encodeURIComponent(
        provider
      )}&page=${page}&limit=20`
    : null;

  const { data, error, isLoading, mutate } = useSWR(query, fetcher);
  const events = data?.events || [];
  const total = Number(data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Webhook Events</h1>
        <p className="text-foreground/60 mt-2">
          Incoming events from BSP providers (Gupshup, Twilio, 360dialog, etc.)
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Provider Filter</label>
            <Input
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. twilio, gupshup, 360dialog"
            />
          </div>
          <Button onClick={() => mutate()}>Refresh</Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-foreground/60">Loading events...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-red-600">
          {String(error.message || error)}
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center text-foreground/60">No webhook events found.</Card>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => (
            <Card key={event.id} className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-sm font-semibold">
                  {event.provider} - {event.event_type}
                </div>
                <div className="text-xs text-foreground/60">
                  {new Date(event.received_at).toLocaleString()}
                </div>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
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

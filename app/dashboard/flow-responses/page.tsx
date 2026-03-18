'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageSquareText, CalendarDays, Phone, Filter } from 'lucide-react';

interface FlowResponseItem {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  flow_name?: string | null;
  flow_id?: string | null;
  booking_date?: string | null;
  booking_time?: string | null;
  service?: string | null;
  assignee?: string | null;
  status?: string | null;
  notes?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load flow responses');
  }
  return data;
};

export default function FlowResponsesPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const query = useMemo(() => {
    if (!workspace?.id) return null;
    const params = new URLSearchParams({
      workspaceId: workspace.id,
      limit: '100',
    });
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    return `/api/flow-responses?${params.toString()}`;
  }, [workspace?.id, statusFilter]);

  const { data, error, isLoading } = useSWR(query, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const responses: FlowResponseItem[] = data?.responses || [];
  const filteredResponses = responses.filter((item) => {
    const haystack = [
      item.customer_name,
      item.phone,
      item.flow_name,
      item.flow_id,
      item.service,
      item.notes,
      item.status,
      JSON.stringify(item.details || {}),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flow Responses</h1>
          <p className="mt-2 text-foreground/60">
            View all WhatsApp Flow submissions, booking details, and captured form data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px]">
            <Input
              placeholder="Search phone, flow, service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <Filter className="h-4 w-4 text-foreground/50" />
            <select
              className="bg-transparent text-sm outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-sm text-foreground/60">Loading flow responses...</Card>
      ) : error ? (
        <Card className="p-8 text-sm text-destructive">{error.message}</Card>
      ) : filteredResponses.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquareText className="mx-auto mb-4 h-12 w-12 text-foreground/20" />
          <h2 className="text-xl font-semibold">No flow responses yet</h2>
          <p className="mt-2 text-foreground/60">
            Responses from appointment and intake flows will appear here after customers submit them.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredResponses.map((item) => (
            <Card key={item.id} className="p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold">
                      {item.customer_name || item.phone || 'Unknown customer'}
                    </h2>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {item.status || 'booked'}
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      {item.flow_name || item.flow_id || 'WhatsApp Flow'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-foreground/65">
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {item.phone || 'No phone'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {[item.booking_date, item.booking_time].filter(Boolean).join(' at ') || 'No slot chosen'}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-wide text-foreground/50">Service</div>
                      <div className="mt-1 text-sm font-medium">{item.service || 'Not provided'}</div>
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-wide text-foreground/50">Assignee</div>
                      <div className="mt-1 text-sm font-medium">{item.assignee || 'Unassigned'}</div>
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-wide text-foreground/50">Submitted</div>
                      <div className="mt-1 text-sm font-medium">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {item.notes ? (
                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-foreground/50">Notes</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</div>
                    </div>
                  ) : null}
                </div>

                <div className="xl:w-[420px]">
                  <Card className="bg-muted/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">Raw Form Data</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(item.details || {}, null, 2))}
                      >
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="max-h-[360px] overflow-auto rounded-xl bg-background p-4 text-xs">
                      {JSON.stringify(item.details || {}, null, 2)}
                    </pre>
                  </Card>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

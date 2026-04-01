'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  MessageSquareText,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react';

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

interface AnswerField {
  key: string;
  label: string;
  value: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load flow responses');
  }
  return data;
};

const HIDDEN_DETAIL_KEYS = new Set([
  'flow_id',
  'flow_token',
  'customer_id',
  'workspace_id',
  'booking_date',
  'booking_time',
  'service',
  'assignee',
  'status',
  'notes',
  'phone',
  'customer_phone',
  'customer_name',
  'created_at',
  'updated_at',
  'appointment_summary',
]);

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValue(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${titleize(key)}: ${formatFieldValue(item)}`)
      .filter((item) => item && !item.endsWith(': '))
      .join(' | ');
  }
  return String(value);
}

function getAnswerFields(item: FlowResponseItem): AnswerField[] {
  const details = item.details && typeof item.details === 'object' ? item.details : {};
  return Object.entries(details)
    .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && formatFieldValue(value))
    .map(([key, value]) => ({
      key,
      label: titleize(key),
      value: formatFieldValue(value),
    }));
}

function getStatusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'confirmed') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'pending') return 'bg-amber-100 text-amber-700';
  if (normalized === 'cancelled') return 'bg-rose-100 text-rose-700';
  return 'bg-sky-100 text-sky-700';
}

export default function FlowResponsesPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selectedResponse =
    filteredResponses.find((item) => item.id === selectedId) || filteredResponses[0] || null;

  const stats = useMemo(() => {
    return filteredResponses.reduce(
      (acc, item) => {
        acc.total += 1;
        if ((item.status || '').toLowerCase() === 'confirmed') acc.confirmed += 1;
        if ((item.status || '').toLowerCase() === 'pending') acc.pending += 1;
        if ([item.booking_date, item.booking_time].some(Boolean)) acc.withSlots += 1;
        return acc;
      },
      { total: 0, confirmed: 0, pending: 0, withSlots: 0 }
    );
  }, [filteredResponses]);

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-medium text-foreground/70">
              <Sparkles className="h-3.5 w-3.5" />
              Customer submissions in one view
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Flow Responses</h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/65">
              Give your team a clean inbox for WhatsApp appointment and intake form submissions without exposing raw JSON.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="min-w-[150px] rounded-2xl border-white/70 bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-foreground/45">Total</div>
              <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
            </Card>
            <Card className="min-w-[150px] rounded-2xl border-white/70 bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-foreground/45">Confirmed</div>
              <div className="mt-2 text-2xl font-semibold">{stats.confirmed}</div>
            </Card>
            <Card className="min-w-[150px] rounded-2xl border-white/70 bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-foreground/45">With Slot</div>
              <div className="mt-2 text-2xl font-semibold">{stats.withSlots}</div>
            </Card>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Input
            placeholder="Search customer, phone, service, flow..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2">
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

      {isLoading ? (
        <Card className="p-8 text-sm text-foreground/60">Loading flow responses...</Card>
      ) : error ? (
        <Card className="p-8 text-sm text-destructive">{error.message}</Card>
      ) : filteredResponses.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquareText className="mx-auto mb-4 h-12 w-12 text-foreground/20" />
          <h2 className="text-xl font-semibold">No flow responses yet</h2>
          <p className="mt-2 text-foreground/60">
            Customer submissions from your WhatsApp flows will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            {filteredResponses.map((item) => {
              const isActive = selectedResponse?.id === item.id;
              const answerFields = getAnswerFields(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full text-left"
                >
                  <Card
                    className={`rounded-3xl p-5 transition-all ${
                      isActive ? 'border-emerald-300 bg-emerald-50/60 shadow-md' : 'hover:border-foreground/20 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {item.customer_name || item.phone || 'Unknown customer'}
                        </div>
                        <div className="mt-1 text-sm text-foreground/55">
                          {item.flow_name || item.flow_id || 'WhatsApp Flow'}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(item.status || 'booked')}`}>
                        {item.status || 'booked'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-foreground/70">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{item.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{[item.booking_date, item.booking_time].filter(Boolean).join(' at ') || 'No slot chosen'}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.service ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground/70">
                          {item.service}
                        </span>
                      ) : null}
                      {answerFields.slice(0, 2).map((field) => (
                        <span
                          key={field.key}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground/60"
                        >
                          {field.label}: {field.value}
                        </span>
                      ))}
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>

          {selectedResponse ? (
            <Card className="rounded-[30px] p-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold">
                        {selectedResponse.customer_name || selectedResponse.phone || 'Unknown customer'}
                      </h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(selectedResponse.status || 'booked')}`}>
                        {selectedResponse.status || 'booked'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground/60">
                      {selectedResponse.flow_name || selectedResponse.flow_id || 'WhatsApp Flow'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-foreground/65">
                    Submitted on {new Date(selectedResponse.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/45">
                      <Phone className="h-4 w-4" />
                      Phone
                    </div>
                    <div className="mt-3 text-sm font-semibold">{selectedResponse.phone || 'Not provided'}</div>
                  </Card>

                  <Card className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/45">
                      <CalendarDays className="h-4 w-4" />
                      Preferred Slot
                    </div>
                    <div className="mt-3 text-sm font-semibold">
                      {[selectedResponse.booking_date, selectedResponse.booking_time].filter(Boolean).join(' at ') || 'Not selected'}
                    </div>
                  </Card>

                  <Card className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/45">
                      <Sparkles className="h-4 w-4" />
                      Service
                    </div>
                    <div className="mt-3 text-sm font-semibold">{selectedResponse.service || 'Not provided'}</div>
                  </Card>

                  <Card className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/45">
                      <UserRound className="h-4 w-4" />
                      Assignee
                    </div>
                    <div className="mt-3 text-sm font-semibold">{selectedResponse.assignee || 'Unassigned'}</div>
                  </Card>
                </div>

                {selectedResponse.notes ? (
                  <Card className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 className="h-4 w-4" />
                      Notes
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/75">{selectedResponse.notes}</p>
                  </Card>
                ) : null}

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold">Submitted Answers</h3>
                  </div>

                  {getAnswerFields(selectedResponse).length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {getAnswerFields(selectedResponse).map((field) => (
                        <Card key={field.key} className="rounded-2xl p-4">
                          <div className="text-xs uppercase tracking-wide text-foreground/45">
                            {field.label}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-foreground/80">
                            {field.value}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="rounded-2xl p-5 text-sm text-foreground/60">
                      No additional answers were captured beyond the booking summary fields.
                    </Card>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            customer: selectedResponse.customer_name || null,
                            phone: selectedResponse.phone || null,
                            flow: selectedResponse.flow_name || selectedResponse.flow_id || null,
                            bookingDate: selectedResponse.booking_date || null,
                            bookingTime: selectedResponse.booking_time || null,
                            service: selectedResponse.service || null,
                            notes: selectedResponse.notes || null,
                            details: selectedResponse.details || {},
                          },
                          null,
                          2
                        )
                      )
                    }
                  >
                    Copy Response
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

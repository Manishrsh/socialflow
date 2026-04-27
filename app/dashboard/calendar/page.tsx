'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, ChevronLeft, ChevronRight, Edit2, Eye, Plus, PauseCircle, Trash2, Upload } from 'lucide-react';

interface CalendarEventItem {
  id: string;
  sourceKind: 'festival' | 'custom';
  sourceKey: string;
  festivalKey?: string | null;
  name: string;
  eventDate: string;
  eventType: string;
  repeatYearly: boolean;
  isEnabled: boolean;
  status: 'Scheduled' | 'Posted' | 'Disabled';
  labelColor: 'green' | 'blue';
  logoUrl?: string | null;
  customImageUrl?: string | null;
  notes?: string | null;
  post?: {
    id: string;
    status: string;
    scheduledFor: string | null;
    postedAt: string | null;
    engagementStatus: string;
    failureReason: string | null;
    creativePreviewUrl: string | null;
    caption: string;
    postTitle: string;
  } | null;
}

interface CalendarResponse {
  calendar: {
    workspaceId: string;
    workspaceName: string;
    monthLabel: string;
    year: number;
    month: number;
    planTier: string;
    planLimits: { customEvents: number | null; festivalMode: string; advancedBranding: boolean };
    branding: {
      businessName: string;
      logoUrl: string;
      brandColorPrimary: string;
      brandColorSecondary: string;
      phoneNumber: string;
      address: string;
      socialHandle: string;
      tagline: string;
      industry: string;
      calendarPostingPaused: boolean;
    };
    events: CalendarEventItem[];
    customEventCount: number;
    festivalCount: number;
    postingPaused: boolean;
    upcomingCount: number;
    pastCount: number;
    failedCount: number;
  };
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
    creativePreviewUrl: string | null;
    caption: string;
  }>;
  pastPosts: Array<{
    id: string;
    eventName: string;
    eventDate: string;
    status: string;
    postedAt: string | null;
    engagementStatus: string;
    creativePreviewUrl: string | null;
    caption: string;
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

const eventTypeOptions = ['Anniversary', 'Sale', 'Custom'];

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export default function CalendarPage() {
  const { workspace } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [previewDraft, setPreviewDraft] = useState<{
    title: string;
    caption: string;
    creativeSvg: string;
    scheduledFor: string;
    imageUrl?: string;
  } | null>(null);
  const [formState, setFormState] = useState({
    eventName: '',
    eventDate: format(new Date(), 'yyyy-MM-dd'),
    eventType: 'Anniversary',
    repeatYearly: false,
    isEnabled: false,
    notes: '',
    logoUrl: '',
    customImageUrl: '',
  });
  const [selectedLogoFileName, setSelectedLogoFileName] = useState('');
  const [selectedCustomImageFileName, setSelectedCustomImageFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [statusText, setStatusText] = useState('');

  const monthKey = format(currentMonth, 'yyyy-MM');

  const { data, error, isLoading, mutate } = useSWR<CalendarResponse>(
    workspace ? `/api/calendar/events?workspaceId=${workspace.id}&month=${monthKey}` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  );

  const { data: postsData, mutate: mutatePosts } = useSWR<CalendarPostsResponse>(
    workspace ? `/api/calendar/posts?workspaceId=${workspace.id}&limit=12` : null,
    fetcher,
    {
      refreshInterval: 20000,
      revalidateOnFocus: true,
    }
  );

  const calendar = data?.calendar;
  const branding = calendar?.branding;
  const customEventLimit = calendar?.planLimits?.customEvents ?? Number.POSITIVE_INFINITY;
  const customEventLimitLabel = Number.isFinite(customEventLimit) ? String(customEventLimit) : 'Unlimited';
  const events = calendar?.events || [];

  const groupedEvents = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of events) {
      const key = dayKey(new Date(event.eventDate));
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (editingEvent) {
      setFormState({
        eventName: editingEvent.name,
        eventDate: format(new Date(editingEvent.eventDate), 'yyyy-MM-dd'),
        eventType: editingEvent.eventType || 'Custom',
        repeatYearly: editingEvent.repeatYearly,
        isEnabled: editingEvent.isEnabled,
        notes: editingEvent.notes || '',
        logoUrl: editingEvent.logoUrl || branding?.logoUrl || '',
        customImageUrl: editingEvent.customImageUrl || '',
      });
      setSelectedLogoFileName('');
      setSelectedCustomImageFileName('');
      return;
    }

    setFormState({
      eventName: '',
      eventDate: format(new Date(), 'yyyy-MM-dd'),
      eventType: 'Anniversary',
      repeatYearly: false,
      isEnabled: false,
      notes: '',
      logoUrl: branding?.logoUrl || '',
      customImageUrl: '',
    });
    setSelectedLogoFileName('');
    setSelectedCustomImageFileName('');
  }, [dialogOpen, editingEvent, branding?.logoUrl]);

  const openCreateDialog = () => {
    setEditingEvent(null);
    setStatusText('');
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEventItem) => {
    if (event.sourceKind !== 'custom') return;
    setEditingEvent(event);
    setStatusText('');
    setDialogOpen(true);
  };

  const openPreview = async (event: {
    eventName: string;
    eventDate: string;
    eventType: string;
    sourceKind: 'festival' | 'custom';
    repeatYearly: boolean;
    logoUrl?: string;
    customImageUrl?: string;
    festivalTone?: string;
  }) => {
    if (!workspace?.id) return;
    setIsPreviewing(true);
    setStatusText('');
    try {
      const response = await fetch('/api/calendar/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          ...event,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to build preview');
      
      if (event.customImageUrl) {
        payload.preview.imageUrl = event.customImageUrl;
        payload.preview.creativeSvg = '';
      }
      setPreviewDraft(payload.preview);
      setPreviewOpen(true);
    } catch (previewError: any) {
      setStatusText(previewError?.message || 'Failed to generate preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!workspace?.id || !file) return;
    setStatusText('');
    try {
      const uploadData = new FormData();
      uploadData.append('workspaceId', workspace.id);
      uploadData.append('file', file);
      uploadData.append('title', `${formState.eventName || branding?.businessName || workspace.name} logo`);
      const response = await fetch('/api/media/upload', { method: 'POST', body: uploadData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to upload logo');
      setFormState((current) => ({ ...current, logoUrl: payload?.url || '' }));
      setSelectedLogoFileName(file.name);
      setStatusText('Logo uploaded successfully');
    } catch (uploadError: any) {
      setStatusText(uploadError?.message || 'Failed to upload logo');
    }
  };

  const uploadCustomImage = async (file: File | null) => {
    if (!workspace?.id || !file) return;
    setStatusText('');
    try {
      const uploadData = new FormData();
      uploadData.append('workspaceId', workspace.id);
      uploadData.append('file', file);
      uploadData.append('title', `${formState.eventName || 'Custom Post'} Image`);
      const response = await fetch('/api/media/upload', { method: 'POST', body: uploadData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to upload custom image');
      setFormState((current) => ({ ...current, customImageUrl: payload?.url || '' }));
      setSelectedCustomImageFileName(file.name);
      setStatusText('Custom image uploaded successfully');
    } catch (uploadError: any) {
      setStatusText(uploadError?.message || 'Failed to upload custom image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) return;

    setIsSaving(true);
    setStatusText('');
    try {
      const payload = {
        workspaceId: workspace.id,
        eventName: formState.eventName,
        eventDate: formState.eventDate,
        eventType: formState.eventType,
        repeatYearly: formState.repeatYearly,
        isEnabled: formState.isEnabled,
        notes: formState.notes,
        logoUrl: formState.logoUrl,
        customImageUrl: formState.customImageUrl,
      };

      const response = await fetch(editingEvent ? `/api/calendar/events/${editingEvent.id}` : '/api/calendar/events', {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to save event');

      setStatusText(editingEvent ? 'Event updated successfully' : 'Event created successfully');
      setDialogOpen(false);
      setEditingEvent(null);
      await mutate();
      await mutatePosts();
    } catch (submitError: any) {
      setStatusText(submitError?.message || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (event: CalendarEventItem) => {
    if (!workspace?.id || event.sourceKind !== 'custom') return;
    setStatusText('');
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          isEnabled: !event.isEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to update event');
      setStatusText(result?.event?.isEnabled ? 'Event enabled and scheduled' : 'Event disabled');
      await mutate();
      await mutatePosts();
    } catch (toggleError: any) {
      setStatusText(toggleError?.message || 'Failed to update event');
    }
  };

  const deleteEvent = async (event: CalendarEventItem) => {
    if (!workspace?.id || event.sourceKind !== 'custom') return;
    const confirmed = window.confirm(`Delete "${event.name}"? This will disable future posting.`);
    if (!confirmed) return;
    setStatusText('');
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to delete event');
      setStatusText('Event deleted');
      await mutate();
      await mutatePosts();
    } catch (deleteError: any) {
      setStatusText(deleteError?.message || 'Failed to delete event');
    }
  };

  const triggerPreviewForSelected = async () => {
    await openPreview({
      eventName: formState.eventName,
      eventDate: formState.eventDate,
      eventType: formState.eventType,
      sourceKind: 'custom',
      repeatYearly: formState.repeatYearly,
      logoUrl: formState.logoUrl,
      customImageUrl: formState.customImageUrl,
    });
  };

  const visibleDates = calendarDays.map((day) => {
    const key = dayKey(day);
    return {
      day,
      events: groupedEvents.get(key) || [],
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground/70">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar-driven marketing automation
          </div>
          <h1 className="mt-3 text-3xl font-bold">Calendar</h1>
          <p className="mt-2 max-w-2xl text-foreground/60">
            Plan festivals and custom business events, preview branded creatives, and schedule Instagram auto-posts from one calendar.
          </p>
          {statusText ? <p className="mt-2 text-sm text-foreground/70">{statusText}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setCurrentMonth((value) => subMonths(value, 1))}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Prev
          </Button>
          <div className="rounded-lg border bg-background px-4 py-2 text-sm font-medium">{format(currentMonth, 'MMMM yyyy')}</div>
          <Button variant="outline" onClick={() => setCurrentMonth((value) => addMonths(value, 1))}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
          <Button onClick={openCreateDialog} disabled={calendar ? calendar.customEventCount >= customEventLimit : false}>
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {error ? <Card className="p-4 text-sm text-destructive">{error.message}</Card> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-foreground/50">Custom Events</div>
          <div className="mt-2 text-2xl font-bold">{calendar?.customEventCount || 0}/{customEventLimitLabel}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-foreground/50">System Festivals</div>
          <div className="mt-2 text-2xl font-bold">{calendar?.festivalCount || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-foreground/50">Upcoming Posts</div>
          <div className="mt-2 text-2xl font-bold">{calendar?.upcomingCount || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-foreground/50">Posting Status</div>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
            {calendar?.postingPaused ? <PauseCircle className="h-5 w-5 text-amber-600" /> : <div className="h-3 w-3 rounded-full bg-emerald-500" />}
            {calendar?.postingPaused ? 'Paused' : 'Live'}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="px-2 py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {visibleDates.map(({ day, events: dayEvents }) => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-36 rounded-2xl border p-2 transition-colors ${inMonth ? 'bg-background' : 'bg-muted/40 text-foreground/45'} ${today ? 'ring-2 ring-primary/30' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${today ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                        {dayEvents.length > 0 ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                            {dayEvents.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            onClick={() =>
                              event.sourceKind === 'custom'
                                ? openEditDialog(event)
                                : openPreview({
                                    eventName: event.name,
                                    eventDate: event.eventDate,
                                    eventType: event.eventType,
                                    sourceKind: 'festival',
                                    repeatYearly: true,
                                    logoUrl: branding?.logoUrl || '',
                                    festivalTone: event.notes || '',
                                  })
                            }
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:shadow-sm ${
                              event.labelColor === 'green'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'
                                : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium">{event.name}</span>
                              <Badge variant="outline" className="ml-2 shrink-0 border-current/30 text-[10px]">
                                {event.status}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                {event.sourceKind}
                              </span>
                              <span className="truncate text-[10px] opacity-70">{event.eventType}</span>
                            </div>
                          </button>
                        ))}
                        {dayEvents.length > 3 ? (
                          <div className="text-[11px] text-foreground/50">+{dayEvents.length - 3} more</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Upcoming Posts</h2>
                <p className="text-sm text-foreground/60">Scheduled, draft, and published creative jobs.</p>
              </div>
              <Eye className="h-5 w-5 text-foreground/40" />
            </div>
            <div className="space-y-3">
              {(postsData?.upcomingPosts || []).slice(0, 5).map((post) => (
                <div key={post.id} className="rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{post.eventName}</div>
                      <div className="mt-1 text-xs text-foreground/60">{format(new Date(post.eventDate), 'dd MMM yyyy')}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{post.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-foreground/60">Engagement: {post.engagementStatus}</div>
                  {post.creativePreviewUrl ? (
                    <button
                      className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary"
                      onClick={() => {
                        setPreviewDraft({
                          title: post.eventName,
                          caption: post.caption,
                          creativeSvg: '',
                          scheduledFor: post.scheduledFor || post.postedAt || '',
                          imageUrl: post.creativePreviewUrl || undefined,
                        });
                        setPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview post
                    </button>
                  ) : null}
                </div>
              ))}
              {!postsData?.upcomingPosts?.length ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">No upcoming posts yet.</div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Past Posts</h2>
                <p className="text-sm text-foreground/60">Recently posted creative history.</p>
              </div>
              <CalendarDays className="h-5 w-5 text-foreground/40" />
            </div>
            <div className="space-y-3">
              {(postsData?.pastPosts || []).slice(0, 4).map((post) => (
                <div key={post.id} className="rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{post.eventName}</div>
                      <div className="mt-1 text-xs text-foreground/60">{format(new Date(post.eventDate), 'dd MMM yyyy')}</div>
                    </div>
                    <Badge variant="secondary" className="capitalize">{post.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-foreground/60">Engagement: {post.engagementStatus}</div>
                </div>
              ))}
              {!postsData?.pastPosts?.length ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">No past posts yet.</div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">System Festivals</h2>
              <p className="text-sm text-foreground/60">Green labels are predefined festivals, blue labels are custom events.</p>
            </div>
            <Badge variant="outline">Plan: {calendar?.planTier || 'basic'}</Badge>
          </div>
          <div className="space-y-3">
            {events.filter((event) => event.sourceKind === 'festival').slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Festival</Badge>
                      <span className="font-medium">{event.name}</span>
                    </div>
                    <div className="mt-2 text-sm text-foreground/60">{format(new Date(event.eventDate), 'dd MMM yyyy')} • {event.eventType}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{event.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openPreview({
                    eventName: event.name,
                    eventDate: event.eventDate,
                    eventType: event.eventType,
                    sourceKind: 'festival',
                    repeatYearly: true,
                    logoUrl: branding?.logoUrl || '',
                    festivalTone: event.notes || '',
                  })}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Custom Events</h2>
              <p className="text-sm text-foreground/60">Blue labels are your shop events, anniversaries, and sales.</p>
            </div>
            <Badge variant="outline">{calendar?.customEventCount || 0}/{customEventLimitLabel}</Badge>
          </div>
          <div className="space-y-3">
            {events.filter((event) => event.sourceKind === 'custom').slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-sky-600 text-white hover:bg-sky-600">Custom</Badge>
                      <span className="font-medium">{event.name}</span>
                    </div>
                    <div className="mt-2 text-sm text-foreground/60">{format(new Date(event.eventDate), 'dd MMM yyyy')} • {event.eventType}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{event.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(event)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleEnabled(event)}>
                    {event.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPreview({
                    eventName: event.name,
                    eventDate: event.eventDate,
                    eventType: event.eventType,
                    sourceKind: 'custom',
                    repeatYearly: event.repeatYearly,
                    logoUrl: event.logoUrl || branding?.logoUrl || '',
                    customImageUrl: event.customImageUrl || '',
                  })}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteEvent(event)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!events.filter((event) => event.sourceKind === 'custom').length ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-foreground/60">No custom events yet.</div>
            ) : null}
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
            <DialogDescription>
              Create branded festival or custom event posts. Preview first, then enable automatic posting.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Event Name</label>
                <Input value={formState.eventName} onChange={(e) => setFormState({ ...formState, eventName: e.target.value })} placeholder="5th Anniversary" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Event Date</label>
                <Input type="date" value={formState.eventDate} onChange={(e) => setFormState({ ...formState, eventDate: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Event Type</label>
                <select
                  value={formState.eventType}
                  onChange={(e) => setFormState({ ...formState, eventType: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {eventTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <Switch
                  checked={formState.repeatYearly}
                  onCheckedChange={(checked) => setFormState({ ...formState, repeatYearly: checked })}
                />
                <div>
                  <div className="text-sm font-medium">Repeat yearly</div>
                  <div className="text-xs text-foreground/60">Useful for anniversaries and annual festival posts.</div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Logo</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input value={formState.logoUrl} onChange={(e) => setFormState({ ...formState, logoUrl: e.target.value })} placeholder="Fallback to brand logo if left blank" className="flex-1" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0] || null)} />
                </label>
              </div>
              {selectedLogoFileName ? <div className="mt-2 text-xs text-foreground/60">Uploaded: {selectedLogoFileName}</div> : null}
            </div>

    <div>
      <label className="mb-2 block text-sm font-medium">Custom Post Image (Optional)</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={formState.customImageUrl} onChange={(e) => setFormState({ ...formState, customImageUrl: e.target.value })} placeholder="Upload an image to replace the auto-generated design" className="flex-1" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          <Upload className="h-4 w-4" />
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCustomImage(e.target.files?.[0] || null)} />
        </label>
      </div>
      {selectedCustomImageFileName ? <div className="mt-2 text-xs text-foreground/60">Uploaded: {selectedCustomImageFileName}</div> : null}
    </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Notes</label>
              <Textarea
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Optional creative direction or seasonal note"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div>
                <div className="text-sm font-medium">Enable auto posting</div>
                <div className="text-xs text-foreground/60">When enabled, a branded creative is generated and scheduled automatically.</div>
              </div>
              <Switch
                checked={formState.isEnabled}
                onCheckedChange={(checked) => setFormState({ ...formState, isEnabled: checked })}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={triggerPreviewForSelected} disabled={isPreviewing}>
                <Eye className="mr-2 h-4 w-4" />
                {isPreviewing ? 'Generating...' : 'Preview Creative'}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Add Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Creative Preview</DialogTitle>
            <DialogDescription>Square 1:1 branded creative generated from your event and branding data.</DialogDescription>
          </DialogHeader>
          {previewDraft ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border bg-muted/20 p-3">
                <img
                  src={previewDraft.creativeSvg ? svgToDataUri(previewDraft.creativeSvg) : previewDraft.imageUrl || ''}
                  alt={previewDraft.title}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-wide text-foreground/50">Caption</div>
                  <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{previewDraft.caption}</pre>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-wide text-foreground/50">Schedule</div>
                  <div className="mt-2 text-sm font-medium">{previewDraft.scheduledFor ? new Date(previewDraft.scheduledFor).toLocaleString() : 'Not scheduled yet'}</div>
                  <div className="mt-2 text-xs text-foreground/60">Use the event form to enable posting once you are happy with the preview.</div>
                </Card>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

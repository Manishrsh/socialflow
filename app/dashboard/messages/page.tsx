'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  CheckCheck,
  Image as ImageIcon,
  Instagram,
  MessageSquare,
  Search,
  Send,
} from 'lucide-react';
import useSWR from 'swr';

interface ThreadItem {
  customerId: string;
  name: string;
  phone: string;
  source: string;
  lastMessage: string;
  lastMessageType: string;
  direction: 'inbound' | 'outbound' | null;
  lastMessageAt: string | null;
}

interface ThreadMessage {
  id: string;
  content: string;
  mediaUrl: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  sentAt: string;
  readAt?: string | null;
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

function formatThreadTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString();
}

function formatBubbleTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function channelMeta(source: string) {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'instagram') {
    return {
      label: 'Instagram',
      icon: Instagram,
      chipClass: 'bg-pink-50 text-pink-700 border-pink-200',
    };
  }
  return {
    label: 'WhatsApp',
    icon: MessageSquare,
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

export default function MessagesPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const providerQuery = providerFilter === 'all' ? '' : `&provider=${providerFilter}`;
  const { data: threadsData, isLoading: isThreadsLoading, mutate: mutateThreads } = useSWR(
    workspace
      ? `/api/messages/threads?workspaceId=${workspace.id}&q=${encodeURIComponent(searchTerm)}${providerQuery}`
      : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 0,
    }
  );

  const threads: ThreadItem[] = threadsData?.threads || [];

  useEffect(() => {
    if (!selectedCustomerId && threads.length > 0) {
      setSelectedCustomerId(threads[0].customerId);
    }
  }, [threads, selectedCustomerId]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.customerId === selectedCustomerId) || null,
    [threads, selectedCustomerId]
  );

  const { data: threadMessagesData, isLoading: isMessagesLoading, mutate: mutateThreadMessages } = useSWR(
    workspace && selectedCustomerId
      ? `/api/messages/thread/${selectedCustomerId}?workspaceId=${workspace.id}`
      : null,
    fetcher,
    {
      refreshInterval: 4000,
      revalidateOnFocus: true,
      dedupingInterval: 0,
    }
  );
  const threadMessages: ThreadMessage[] = threadMessagesData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, selectedCustomerId]);

  const handleSelectThread = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowMobileThread(true);
  };

  const handleSendReply = async () => {
    if (!workspace?.id || !selectedCustomerId || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const response = await fetch(
        `/api/messages/thread/${selectedCustomerId}?workspaceId=${workspace.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: replyText.trim() }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send reply');
      }

      setReplyText('');
      await Promise.all([mutateThreadMessages(), mutateThreads()]);
    } catch (error: any) {
      alert(error?.message || 'Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="mt-2 text-foreground/60">WhatsApp-style inbox for your customer conversations.</p>
        </div>
        <div className="hidden rounded-2xl border bg-card px-4 py-3 text-sm text-foreground/60 lg:block">
          Live updates every few seconds
        </div>
      </div>

      <div className="grid min-h-[72vh] grid-cols-1 overflow-hidden rounded-[28px] border bg-card shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`${showMobileThread ? 'hidden lg:flex' : 'flex'} min-h-[72vh] flex-col border-r bg-[#f7f5ef]`}>
          <div className="border-b bg-card/80 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Chats</div>
                <div className="text-xs text-foreground/60">{threads.length} conversations</div>
              </div>
              <select
                value={providerFilter}
                onChange={(e) =>
                  setProviderFilter((e.target.value as 'all' | 'whatsapp' | 'instagram') || 'all')
                }
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                placeholder="Search by name, phone, or message"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border-0 bg-muted pl-10 shadow-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isThreadsLoading ? (
              <div className="p-6 text-sm text-foreground/60">Loading conversations...</div>
            ) : threads.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-foreground/20" />
                <div className="text-sm text-foreground/60">No conversations found</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {threads.map((thread) => {
                  const channel = channelMeta(thread.source);
                  const ChannelIcon = channel.icon;
                  const isActive = selectedCustomerId === thread.customerId;
                  return (
                    <button
                      key={thread.customerId}
                      onClick={() => handleSelectThread(thread.customerId)}
                      className={`w-full rounded-2xl p-3 text-left transition ${
                        isActive ? 'bg-card shadow-sm ring-1 ring-border' : 'hover:bg-card/70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d9f5ec] text-sm font-semibold text-emerald-700">
                          {(thread.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate font-semibold">{thread.name}</div>
                            <div className="shrink-0 text-[11px] text-foreground/50">
                              {formatThreadTime(thread.lastMessageAt)}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-foreground/50">
                            <span>{thread.phone}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${channel.chipClass}`}>
                              <ChannelIcon className="h-3 w-3" />
                              {channel.label}
                            </span>
                          </div>
                          <div className="mt-2 truncate text-sm text-foreground/70">
                            {thread.lastMessage || '[No message]'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={`${showMobileThread ? 'flex' : 'hidden lg:flex'} min-h-[72vh] flex-col bg-[#efeae2]`}>
          {!selectedThread ? (
            <div className="flex h-full items-center justify-center p-8 text-foreground/60">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setShowMobileThread(false)}
                  className="rounded-xl p-2 hover:bg-muted lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9f5ec] text-sm font-semibold text-emerald-700">
                  {(selectedThread.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{selectedThread.name}</div>
                  <div className="text-xs text-foreground/60">{selectedThread.phone}</div>
                </div>
                <div className={`hidden items-center gap-1 rounded-full border px-3 py-1 text-xs sm:inline-flex ${channelMeta(selectedThread.source).chipClass}`}>
                  {(() => {
                    const ChannelIcon = channelMeta(selectedThread.source).icon;
                    return <ChannelIcon className="h-3 w-3" />;
                  })()}
                  {channelMeta(selectedThread.source).label}
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(17,24,39,0.04) 1px, transparent 0)',
                  backgroundSize: '22px 22px',
                }}
              >
                {isMessagesLoading ? (
                  <div className="text-sm text-foreground/60">Loading messages...</div>
                ) : threadMessages.length === 0 ? (
                  <div className="text-sm text-foreground/60">No messages in this thread.</div>
                ) : (
                  <div className="space-y-3">
                    {threadMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%] ${
                            msg.direction === 'outbound'
                              ? 'rounded-br-md bg-[#d9fdd3] text-slate-900'
                              : 'rounded-bl-md bg-white text-slate-900'
                          }`}
                        >
                          {msg.mediaUrl ? (
                            <div className="space-y-2">
                              {msg.type === 'media' || msg.type === 'image' ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={msg.mediaUrl}
                                  alt={msg.content || 'media'}
                                  className="max-h-72 w-full rounded-xl object-cover"
                                />
                              ) : (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-3 text-sm underline"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  Open attachment
                                </a>
                              )}
                              {msg.content ? <div className="whitespace-pre-wrap text-sm">{msg.content}</div> : null}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                          )}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-foreground/50">
                            <span>{formatBubbleTime(msg.sentAt)}</span>
                            {msg.direction === 'outbound' ? <CheckCheck className="h-3 w-3" /> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t bg-card/95 p-3 backdrop-blur sm:p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${selectedThread.name}...`}
                    rows={1}
                    className="max-h-40 min-h-[48px] flex-1 resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isSendingReply) handleSendReply();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#128c7e] text-white transition hover:bg-[#0f7a6f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {selectedThread.source.toLowerCase() === 'instagram' ? (
                  <p className="mt-2 text-xs text-foreground/60">
                    Reply will be queued through your Instagram channel.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

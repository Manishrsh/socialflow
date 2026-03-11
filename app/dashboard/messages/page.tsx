'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search } from 'lucide-react';
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
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MessagesPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const providerQuery = providerFilter === 'all' ? '' : `&provider=${providerFilter}`;
  const { data: threadsData, isLoading: isThreadsLoading, mutate: mutateThreads } = useSWR(
    workspace
      ? `/api/messages/threads?workspaceId=${workspace.id}&q=${encodeURIComponent(searchTerm)}${providerQuery}`
      : null,
    fetcher
  );

  const threads: ThreadItem[] = threadsData?.threads || [];
  const selectedThread = useMemo(
    () => threads.find((t) => t.customerId === selectedCustomerId) || null,
    [threads, selectedCustomerId]
  );

  const { data: threadMessagesData, isLoading: isMessagesLoading, mutate: mutateThreadMessages } = useSWR(
    workspace && selectedCustomerId
      ? `/api/messages/thread/${selectedCustomerId}?workspaceId=${workspace.id}`
      : null,
    fetcher
  );
  const threadMessages: ThreadMessage[] = threadMessagesData?.messages || [];

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

  const sourceBadge = (source: string) => {
    const normalized = source.toLowerCase();
    if (normalized === 'instagram') {
      return <span className="text-xs px-2 py-0.5 rounded bg-pink-100 text-pink-700">Instagram</span>;
    }
    if (normalized === 'whatsapp' || normalized === 'wpbox' || normalized === '360dialog') {
      return <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">WhatsApp</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground/70">{source}</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-foreground/60 mt-2">Unified inbox for WhatsApp and Instagram conversations</p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={providerFilter}
            onChange={(e) =>
              setProviderFilter((e.target.value as 'all' | 'whatsapp' | 'instagram') || 'all')
            }
            className="px-3 py-2 rounded-lg border border-border bg-background"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[65vh]">
        <Card className="p-3 lg:col-span-1 overflow-auto">
          {isThreadsLoading ? (
            <div className="p-6 text-sm text-foreground/60">Loading conversations...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
              <div className="text-sm text-foreground/60">No conversations found</div>
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.customerId}
                  onClick={() => setSelectedCustomerId(thread.customerId)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCustomerId === thread.customerId
                      ? 'bg-muted border-primary/30'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{thread.name}</div>
                    {sourceBadge(thread.source)}
                  </div>
                  <div className="text-xs text-foreground/60 truncate">{thread.phone}</div>
                  <div className="text-xs text-foreground/70 mt-1 truncate">
                    {thread.lastMessage || '[No message]'}
                  </div>
                  <div className="text-[11px] text-foreground/50 mt-1">
                    {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2 flex flex-col">
          {!selectedThread ? (
            <div className="h-full min-h-[40vh] flex items-center justify-center text-foreground/60">
              Select a conversation
            </div>
          ) : isMessagesLoading ? (
            <div className="p-4 text-sm text-foreground/60">Loading messages...</div>
          ) : threadMessages.length === 0 ? (
            <div className="p-4 text-sm text-foreground/60">No messages in this thread.</div>
          ) : (
            <div className="space-y-3">
              <div className="border-b pb-3 mb-2">
                <div className="font-semibold">{selectedThread.name}</div>
                <div className="text-xs text-foreground/60">{selectedThread.phone}</div>
              </div>
              {threadMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.direction === 'outbound'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.content && <div>{msg.content}</div>}
                  {msg.mediaUrl && (
                    <a
                      className="underline text-xs break-all"
                      href={msg.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {msg.type === 'media' ? 'View media' : msg.mediaUrl}
                    </a>
                  )}
                  <div className="text-[11px] opacity-70 mt-1">
                    {new Date(msg.sentAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedThread && (
            <div className="border-t mt-4 pt-3">
              <div className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selectedThread.name}...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isSendingReply) {
                        handleSendReply();
                      }
                    }
                  }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={isSendingReply || !replyText.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {isSendingReply ? 'Sending...' : 'Send'}
                </button>
              </div>
              {selectedThread.source.toLowerCase() === 'instagram' && (
                <p className="text-xs text-foreground/60 mt-2">
                  Reply queued to Own BSP for Instagram channel.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Trash2, Edit2, Search, Plus } from 'lucide-react';
import useSWR from 'swr';
import { ScheduleMessageFormModal } from '@/components/messages/ScheduleMessageFormModal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScheduledMessage {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  message: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'skipped' | 'cancelled';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ScheduledMessagesPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent' | 'skipped' | 'cancelled'>('all');
  const [page, setPage] = useState(0);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const pageSize = 20;

  const { data, isLoading, mutate } = useSWR(
    workspace
      ? `/api/messages/scheduled?workspaceId=${workspace.id}&status=${statusFilter === 'all' ? '' : statusFilter}&limit=${pageSize}&offset=${page * pageSize}`
      : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const messages: ScheduledMessage[] = data?.messages || [];
  const pagination = data?.pagination || {};

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled message?')) return;

    try {
      const response = await fetch(`/api/messages/scheduled/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        mutate();
      } else {
        alert('Failed to cancel message');
      }
    } catch (error) {
      alert('Error cancelling message');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'skipped':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (!workspace) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-background">
      <div className="flex items-center justify-between border-b p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Scheduled Messages</h1>
            <p className="text-sm text-foreground/60">Manage messages scheduled to be sent later</p>
          </div>
        </div>
        <Button onClick={() => setFormModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <Input
                placeholder="Search by phone or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'sent', 'skipped', 'cancelled'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(0);
                  }}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {/* Messages Table */}
          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-foreground/60">Loading scheduled messages...</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-foreground/60">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No scheduled messages found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-left font-medium">Message</th>
                      <th className="px-4 py-3 text-left font-medium">Scheduled For</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg) => (
                      <tr key={msg.id} className="border-b hover:bg-muted/50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium">{msg.phone}</div>
                          <div className="text-xs text-foreground/60">{msg.customerName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs truncate text-foreground/80">{msg.message}</div>
                          <div className="text-xs text-foreground/60 mt-1">
                            Created: {formatDate(msg.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{formatDate(msg.scheduledAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={getStatusColor(msg.status)}>
                            {msg.status}
                          </Badge>
                          {msg.errorMessage && (
                            <div className="text-xs text-red-600 mt-1">{msg.errorMessage}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {msg.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    // TODO: Implement reschedule
                                    alert('Reschedule not yet implemented');
                                  }}
                                  className="p-2 hover:bg-muted rounded"
                                  title="Reschedule"
                                >
                                  <Edit2 className="h-4 w-4 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => handleDelete(msg.id)}
                                  className="p-2 hover:bg-muted rounded"
                                  title="Cancel"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </button>
                              </>
                            )}
                            {msg.status !== 'pending' && (
                              <span className="text-xs text-foreground/40">No actions available</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {pagination.total > pageSize && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground/60">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, pagination.total)} of{' '}
                {pagination.total} messages
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Message Form Modal */}
      <ScheduleMessageFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        workspaceId={workspace?.id}
        onSuccess={() => {
          mutate();
          setFormModalOpen(false);
        }}
      />
    </div>
  );
}

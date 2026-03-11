'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Send, CheckCircle } from 'lucide-react';

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  recipient_tag: string | null;
  status: string;
  recipient_count: number;
  created_at: string;
  sent_at: string | null;
}

export default function BroadcastsPage() {
  const { workspace } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    recipientTag: '',
  });

  const loadBroadcasts = async () => {
    if (!workspace?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/broadcasts/list?workspaceId=${workspace.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load broadcasts');
      setBroadcasts(Array.isArray(data?.broadcasts) ? data.broadcasts : []);
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to load broadcasts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
  }, [workspace?.id]);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) {
      setStatusText('Workspace not found');
      return;
    }
    setIsSubmitting(true);
    setStatusText('');
    try {
      const res = await fetch('/api/broadcasts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          title: formData.title,
          message: formData.message,
          recipientTag: formData.recipientTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create broadcast');
      setStatusText(`Broadcast sent to ${data?.data?.recipientCount || 0} recipients`);
      setFormData({ title: '', message: '', recipientTag: '' });
      setIsDialogOpen(false);
      await loadBroadcasts();
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to create broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Broadcast Campaigns</h1>
          <p className="text-foreground/60 mt-2">Send messages to multiple customers at once</p>
          {statusText ? <p className="text-sm mt-2 text-foreground/70">{statusText}</p> : null}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Broadcast Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBroadcast} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Title</label>
                <Input
                  placeholder="e.g., New Collection Launch"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  placeholder="Your broadcast message..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border"
                  rows={4}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Target Audience Tag (optional)</label>
                <Input
                  placeholder="e.g., vip"
                  value={formData.recipientTag}
                  onChange={(e) => setFormData({ ...formData, recipientTag: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-foreground/60">Loading broadcasts...</Card>
      ) : broadcasts.length === 0 ? (
        <Card className="p-12 text-center">
          <Send className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No broadcasts yet</h3>
          <p className="text-foreground/60">Create your first broadcast campaign to reach your customers</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {broadcasts.map((broadcast) => (
            <Card key={broadcast.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{broadcast.title}</h3>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-400">
                      {broadcast.status === 'sent' ? 'Sent' : broadcast.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/70 mt-2">{broadcast.message}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-foreground/60">
                    <span>{broadcast.recipient_count} recipients</span>
                    {broadcast.recipient_tag ? <span>Tag: {broadcast.recipient_tag}</span> : null}
                    <span>Created {new Date(broadcast.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-green-600">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

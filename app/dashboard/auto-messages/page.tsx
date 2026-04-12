'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Trash2, Edit2 } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AutoRule {
  id: string;
  rule_type: string;
  message_template: string;
  delay_hours: number;
  delay_minutes: number;
  enabled: boolean;
  created_at: string;
}

export default function AutoMessagesPage() {
  const { workspace } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ruleType: 'new_users',
    messageTemplate: '',
    delayHours: 3,
    delayMinutes: 0,
  });

  const { data, mutate, isLoading } = useSWR(
    workspace?.id ? `/api/messages/auto-rules?workspaceId=${workspace.id}` : null,
    fetcher
  );

  const rules = data?.rules || [];

  const handleAddRule = async () => {
    if (!formData.messageTemplate.trim()) {
      alert('Please enter a message template');
      return;
    }

    try {
      const response = await fetch('/api/messages/auto-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          ruleType: formData.ruleType,
          messageTemplate: formData.messageTemplate,
          delayHours: parseInt(String(formData.delayHours)),
          delayMinutes: parseInt(String(formData.delayMinutes)),
        }),
      });

      if (response.ok) {
        setFormData({
          ruleType: 'new_users',
          messageTemplate: '',
          delayHours: 3,
          delayMinutes: 0,
        });
        setShowForm(false);
        mutate();
      }
    } catch (error) {
      console.error('[v0] Add rule error:', error);
      alert('Failed to create rule');
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/messages/auto-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      mutate();
    } catch (error) {
      console.error('[v0] Toggle error:', error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await fetch(`/api/messages/auto-rules/${ruleId}`, {
        method: 'DELETE',
      });
      mutate();
    } catch (error) {
      console.error('[v0] Delete error:', error);
    }
  };

  const handleBroadcast = async () => {
    const message = prompt('Enter message to broadcast to all customers:');
    if (!message) return;

    const delayHours = prompt('Delay hours (0 for immediate):', '0');
    if (delayHours === null) return;

    try {
      const response = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          message,
          delayHours: parseInt(delayHours),
        }),
      });

      const result = await response.json();
      if (response.ok) {
        alert(`Message scheduled for ${result.scheduled} customers`);
      } else {
        alert('Failed to broadcast message');
      }
    } catch (error) {
      console.error('[v0] Broadcast error:', error);
      alert('Error broadcasting message');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Auto Messages</h1>
            <p className="text-sm text-foreground/60">Automate messages for new users and broadcast to all</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBroadcast} variant="outline" className="gap-2">
            Broadcast All
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Form */}
        {showForm && (
          <Card className="p-6 border-primary/20">
            <h3 className="font-semibold mb-4">Create Auto-Message Rule</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Rule Type</label>
                <select
                  value={formData.ruleType}
                  onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background"
                >
                  <option value="new_users">New Users</option>
                  <option value="all_customers">All Customers</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Message</label>
                <textarea
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                  placeholder="Enter your message..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Delay Hours</label>
                  <input
                    type="number"
                    value={formData.delayHours}
                    onChange={(e) => setFormData({ ...formData, delayHours: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="24"
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Delay Minutes</label>
                  <input
                    type="number"
                    value={formData.delayMinutes}
                    onChange={(e) => setFormData({ ...formData, delayMinutes: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="59"
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRule}>Create Rule</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Rules List */}
        {isLoading ? (
          <Card className="p-6 text-center text-foreground/60">Loading rules...</Card>
        ) : rules.length === 0 ? (
          <Card className="p-6 text-center text-foreground/60">
            No auto-message rules yet. Create one to get started!
          </Card>
        ) : (
          <div className="space-y-2">
            {rules.map((rule: AutoRule) => (
              <Card key={rule.id} className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium capitalize">{rule.rule_type.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {rule.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/70 mb-2">{rule.message_template}</p>
                  <p className="text-xs text-foreground/60">
                    Delay: {rule.delay_hours}h {rule.delay_minutes}m
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(rule.id, rule.enabled)}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

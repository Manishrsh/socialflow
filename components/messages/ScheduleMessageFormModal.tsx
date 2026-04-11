'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, AlertCircle } from 'lucide-react';
import useSWR from 'swr';

interface ScheduleMessageFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: any) => void;
  workspaceId?: string;
}

export function ScheduleMessageFormModal({
  open,
  onOpenChange,
  onSuccess,
  workspaceId,
}: ScheduleMessageFormModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'fixed' | 'delay'>('fixed');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [delayHours, setDelayHours] = useState('0');
  const [delayMinutes, setDelayMinutes] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: customers = [] } = useSWR(
    workspaceId ? `/api/customers?workspaceId=${workspaceId}` : null
  );

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 1);
  const maxDateTime = new Date();
  maxDateTime.setHours(maxDateTime.getHours() + 24);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId || !message.trim()) {
      setError('Please select a customer and enter a message');
      return;
    }

    if (scheduleMode === 'fixed') {
      if (!scheduledDate || !scheduledTime) {
        setError('Please select a date and time');
        return;
      }

      const [hours, minutes] = scheduledTime.split(':');
      const selected = new Date(`${scheduledDate}T${hours}:${minutes}`);

      if (selected < minDateTime) {
        setError('Cannot schedule in the past');
        return;
      }

      if (selected > maxDateTime) {
        setError('Cannot schedule more than 24 hours in advance');
        return;
      }
    } else {
      const hours = parseInt(delayHours) || 0;
      const mins = parseInt(delayMinutes) || 0;
      const totalMinutes = hours * 60 + mins;

      if (totalMinutes <= 0) {
        setError('Delay must be greater than 0');
        return;
      }

      if (totalMinutes > 24 * 60) {
        setError('Delay cannot exceed 24 hours');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const payload: any = {
        customerId: selectedCustomerId,
        message: message.trim(),
        scheduleMode,
      };

      if (scheduleMode === 'fixed') {
        const [hours, minutes] = scheduledTime.split(':');
        payload.scheduledAt = new Date(
          `${scheduledDate}T${hours}:${minutes}`
        ).toISOString();
      } else {
        payload.delayHours = parseInt(delayHours) || 0;
        payload.delayMinutes = parseInt(delayMinutes) || 0;
      }

      const res = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to schedule message');
      }

      const result = await res.json();
      onSuccess?.(result);
      onOpenChange(false);

      // Reset form
      setSelectedCustomerId('');
      setMessage('');
      setScheduleMode('fixed');
      setScheduledDate('');
      setScheduledTime('');
      setDelayHours('0');
      setDelayMinutes('0');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule New Message</DialogTitle>
          <DialogDescription>
            Create a new scheduled message to send to a customer
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a customer...</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the message to schedule..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Schedule Mode */}
          <div>
            <label className="block text-sm font-medium mb-3">Scheduling Method</label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`p-3 cursor-pointer transition ${
                  scheduleMode === 'fixed' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setScheduleMode('fixed')}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="mode"
                    value="fixed"
                    checked={scheduleMode === 'fixed'}
                    onChange={(e) => setScheduleMode(e.target.value as 'fixed' | 'delay')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-sm">Send at Fixed Time</p>
                    <p className="text-xs text-foreground/60 mt-1">Schedule for a specific date and time</p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition ${
                  scheduleMode === 'delay' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setScheduleMode('delay')}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="mode"
                    value="delay"
                    checked={scheduleMode === 'delay'}
                    onChange={(e) => setScheduleMode(e.target.value as 'fixed' | 'delay')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-sm">Send After Delay</p>
                    <p className="text-xs text-foreground/60 mt-1">Send X hours after customer&apos;s last message</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Fixed Time Schedule */}
          {scheduleMode === 'fixed' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDateTime.toISOString().split('T')[0]}
                  max={maxDateTime.toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Delay Schedule */}
          {scheduleMode === 'delay' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground/60">
                Message will be sent this many hours and minutes after the customer&apos;s last message
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Hours (0-24)</label>
                  <input
                    type="number"
                    value={delayHours}
                    onChange={(e) => setDelayHours(e.target.value)}
                    min="0"
                    max="24"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Minutes (0-59)</label>
                  <input
                    type="number"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(e.target.value)}
                    min="0"
                    max="59"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Card className="p-3 bg-red-50 border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </Card>
          )}

          {/* Info Box */}
          <Card className="p-3 bg-blue-50 border-blue-200 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">24-Hour Window Rule</p>
              <p>Messages can only be sent to customers who were active in the last 24 hours (WhatsApp policy)</p>
            </div>
          </Card>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Scheduling...' : 'Schedule Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

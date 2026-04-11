import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useScheduleMessage } from '@/lib/hooks/useScheduleMessage';
import { AlertCircle, Clock } from 'lucide-react';

interface ScheduleMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onSuccess: (message: any) => void;
}

export function ScheduleMessageModal({
  open,
  onOpenChange,
  customerId,
  onSuccess,
}: ScheduleMessageModalProps) {
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { schedule, isLoading, error, setError } = useScheduleMessage();

  const now = new Date();
  const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Format date for input
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Initialize with 1 hour from now
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      const defaultTime = new Date(now.getTime() + 60 * 60 * 1000);
      setScheduledDate(formatDateForInput(defaultTime));
      setScheduledTime(formatTimeForInput(defaultTime));
      setMessage('');
      setValidationError(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const validateDateTime = (): boolean => {
    if (!scheduledDate || !scheduledTime) {
      setValidationError('Please select date and time');
      return false;
    }

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const dateObj = new Date(scheduledDate);
    dateObj.setHours(hours, minutes, 0, 0);

    if (dateObj < now) {
      setValidationError('Scheduled time must be in the future');
      return false;
    }

    if (dateObj > maxDate) {
      setValidationError('Messages can only be scheduled within 24 hours');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSchedule = async () => {
    if (!validateDateTime() || !message.trim()) {
      if (!message.trim()) {
        setValidationError('Please enter a message');
      }
      return;
    }

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const dateObj = new Date(scheduledDate);
    dateObj.setHours(hours, minutes, 0, 0);

    const result = await schedule({
      customerId,
      message: message.trim(),
      scheduledAt: dateObj,
    });

    if (result) {
      onSuccess(result);
      handleOpenChange(false);
    }
  };

  const isValid = scheduledDate && scheduledTime && message.trim() && !validationError && !error;
  const remaining24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current time info */}
          <div className="text-xs text-foreground/60 bg-muted p-2 rounded">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" />
              <span>Current time: {now.toLocaleString()}</span>
            </div>
            <span>Max scheduling time: {remaining24h.toLocaleString()}</span>
          </div>

          {/* Message input */}
          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <Textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setValidationError(null);
              }}
              placeholder="Enter message content"
              className="min-h-24"
              maxLength={4096}
            />
            <div className="text-xs text-foreground/60 mt-1">
              {message.length}/4096 characters
            </div>
          </div>

          {/* Date input */}
          <div>
            <label className="text-sm font-medium mb-1 block">Date</label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                setValidationError(null);
              }}
              min={formatDateForInput(now)}
              max={formatDateForInput(maxDate)}
            />
          </div>

          {/* Time input */}
          <div>
            <label className="text-sm font-medium mb-1 block">Time</label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => {
                setScheduledTime(e.target.value);
                setValidationError(null);
              }}
            />
          </div>

          {/* Validation error */}
          {validationError && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{validationError}</AlertDescription>
            </Alert>
          )}

          {/* API error */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Info message */}
          <div className="text-xs text-foreground/60 bg-blue-50 border border-blue-200 p-2 rounded">
            Message will only be sent if customer has been active within 24 hours from your message sending time.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!isValid || isLoading}>
            {isLoading ? 'Scheduling...' : 'Schedule Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';

interface ScheduleMessageParams {
  customerId: string;
  message: string;
  scheduledAt: Date;
}

interface ScheduleMessageResponse {
  id: string;
  customerId: string;
  phone: string;
  message: string;
  scheduledAt: Date;
  status: string;
  createdAt: Date;
}

export function useScheduleMessage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedule = async (params: ScheduleMessageParams): Promise<ScheduleMessageResponse | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate time is within 24 hours
      const now = new Date();
      const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (params.scheduledAt < now) {
        setError('Scheduled time must be in the future');
        return null;
      }

      if (params.scheduledAt > maxTime) {
        setError('Messages can only be scheduled within 24 hours');
        return null;
      }

      const response = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to schedule message');
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { schedule, isLoading, error, setError };
}

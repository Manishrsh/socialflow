'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useState } from 'react';

interface Alert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  action_url?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  isLoading?: boolean;
}

const SEVERITY_CONFIG = {
  high: { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, border: 'border-red-200' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle, border: 'border-amber-200' },
  low: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Info, border: 'border-blue-200' },
};

export function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-20 rounded bg-muted" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  const activeAlerts = alerts.filter(
    (_, i) => !dismissedAlerts.has(`${alerts.indexOf(_)}-${_.message}`)
  );

  if (activeAlerts.length === 0) {
    return (
      <Card className="p-6 border-green-200 bg-green-50">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">All systems operating normally</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Active Alerts ({activeAlerts.length})</h3>
      {activeAlerts.slice(0, 5).map((alert, i) => {
        const config = SEVERITY_CONFIG[alert.severity];
        const Icon = config.icon;
        const key = `${i}-${alert.message}`;

        return (
          <Card
            key={key}
            className={`p-4 border-2 ${config.border} ${config.bg}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.color}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${config.color}`}>
                    {alert.type.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  <p className="text-sm mt-1">{alert.message}</p>
                  <p className="text-xs text-foreground/50 mt-2">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissedAlerts(new Set([...dismissedAlerts, key]))}
                className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {alert.action_url && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => window.location.href = alert.action_url!}
              >
                View Details
              </Button>
            )}
          </Card>
        );
      })}
      {activeAlerts.length > 5 && (
        <p className="text-xs text-foreground/60 text-center py-2">
          +{activeAlerts.length - 5} more alerts
        </p>
      )}
    </div>
  );
}

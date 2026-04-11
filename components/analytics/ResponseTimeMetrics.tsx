'use client';

import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Clock } from 'lucide-react';

interface ResponseMetricsData {
  summary: {
    avg_response_time: number;
    median_response_time: number;
    p95_response_time: number;
    sla_compliance_rate: number;
  };
  distribution: {
    under_1min: number;
    '1_to_5min': number;
    '5min_to_1hour': number;
    'over_1hour': number;
  };
  daily_breakdown: Array<{
    day: string;
    avg_time: number;
    message_count: number;
  }>;
}

interface ResponseTimeMetricsProps {
  data: ResponseMetricsData;
  isLoading?: boolean;
}

export function ResponseTimeMetrics({ data, isLoading }: ResponseTimeMetricsProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-48 w-full rounded bg-muted" />
        </div>
      </Card>
    );
  }

  const formatSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const distributionData = [
    { name: '< 1min', value: data.distribution.under_1min },
    { name: '1-5min', value: data.distribution['1_to_5min'] },
    { name: '5min-1h', value: data.distribution['5min_to_1hour'] },
    { name: '> 1h', value: data.distribution['over_1hour'] },
  ];

  const slaStatus = data.summary.sla_compliance_rate >= 80 ? 'good' : 'warning';

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5" />
          <h3 className="font-semibold">Response Time Metrics</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-slate-50">
            <p className="text-xs text-foreground/60 mb-1">Average</p>
            <p className="text-lg font-bold">{formatSeconds(data.summary.avg_response_time)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50">
            <p className="text-xs text-foreground/60 mb-1">Median</p>
            <p className="text-lg font-bold">{formatSeconds(data.summary.median_response_time)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50">
            <p className="text-xs text-foreground/60 mb-1">P95</p>
            <p className="text-lg font-bold">{formatSeconds(data.summary.p95_response_time)}</p>
          </div>
          <div className={`p-4 rounded-lg ${slaStatus === 'good' ? 'bg-green-50' : 'bg-amber-50'}`}>
            <p className="text-xs text-foreground/60 mb-1">SLA Rate</p>
            <p className={`text-lg font-bold ${slaStatus === 'good' ? 'text-green-600' : 'text-amber-600'}`}>
              {data.summary.sla_compliance_rate}%
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Response Time Distribution</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Response Time Trend</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.daily_breakdown.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: any) => formatSeconds(value)}
              />
              <Line
                type="monotone"
                dataKey="avg_time"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

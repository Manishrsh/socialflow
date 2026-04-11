'use client';

import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SentimentGaugeProps {
  overall: number;
  breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  isLoading?: boolean;
}

export function SentimentGauge({ overall, breakdown, isLoading }: SentimentGaugeProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-24 rounded bg-muted" />
          <div className="h-48 w-full rounded bg-muted" />
        </div>
      </Card>
    );
  }

  const data = [
    { name: 'Positive', value: breakdown.positive, color: '#10b981' },
    { name: 'Neutral', value: breakdown.neutral, color: '#6b7280' },
    { name: 'Negative', value: breakdown.negative, color: '#ef4444' },
  ];

  const total = breakdown.positive + breakdown.neutral + breakdown.negative;
  const positivePercent = total > 0 ? ((breakdown.positive / total) * 100).toFixed(0) : 0;

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="font-semibold">Customer Sentiment</h3>
        <p className="text-3xl font-bold mt-2">
          {(overall * 100).toFixed(0)}%
          <span className="text-lg text-foreground/60 ml-2">Positive</span>
        </p>
      </div>

      {total > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, color }) => (
                <span style={{ color }}>
                  {name}: {value}
                </span>
              )}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => `${value} messages`} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-48 flex items-center justify-center text-foreground/60">
          No sentiment data available
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 rounded-lg bg-green-50">
          <p className="text-sm text-foreground/60">Positive</p>
          <p className="text-lg font-bold text-green-600">{breakdown.positive}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-50">
          <p className="text-sm text-foreground/60">Neutral</p>
          <p className="text-lg font-bold text-gray-600">{breakdown.neutral}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-red-50">
          <p className="text-sm text-foreground/60">Negative</p>
          <p className="text-lg font-bold text-red-600">{breakdown.negative}</p>
        </div>
      </div>
    </Card>
  );
}

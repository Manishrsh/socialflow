'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Clock } from 'lucide-react';
import { useParams } from 'next/navigation';

interface AnalyticsData {
  summary?: {
    total_messages: number;
    incoming_messages: number;
    outgoing_messages: number;
    active_customers: number;
  };
  daily_trends?: Array<{
    date: string;
    total_messages: number;
    incoming: number;
    outgoing: number;
  }>;
  message_type_breakdown?: Array<{
    type: string;
    count: number;
  }>;
}

export default function AnalyticsDashboard() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [data, setData] = useState<AnalyticsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch summary analytics data
        const summaryRes = await fetch(`/api/analytics/summary?workspaceId=${workspaceId}&days=${dateRange}`);
        
        if (!summaryRes.ok) {
          throw new Error(`Failed to fetch analytics: ${summaryRes.status}`);
        }

        const response = await summaryRes.json();

        // API returns { summary: {...}, trend: [...], messageTypes: [...], ... }
        // Extract the summary object
        const summaryData = response.summary || {};

        setData({
          summary: {
            total_messages: Number(summaryData.totalMessages || 0),
            incoming_messages: Number(summaryData.incomingMessages || 0),
            outgoing_messages: Number(summaryData.outgoingMessages || 0),
            active_customers: Number(summaryData.activeCustomers || 0),
          },
        });
      } catch (error) {
        console.error('[v0] Failed to fetch analytics:', error);
        setError('Failed to load analytics data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      fetchAnalytics();
    }
  }, [workspaceId, dateRange]);

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  const KPICard = ({ icon: Icon, label, value, trend }: any) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground/60 mb-1">{label}</p>
          <p className="text-2xl font-bold">{formatNumber(value)}</p>
        </div>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {trend && <p className="text-xs text-emerald-600 mt-2">{trend}</p>}
    </Card>
  );

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-foreground/60 mt-1">Real-time insights and performance metrics</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant={dateRange === days ? 'default' : 'outline'}
                onClick={() => setDateRange(days as 7 | 30 | 90)}
              >
                {days} Days
              </Button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 border border-red-200 mb-6">
            <p className="text-red-800">{error}</p>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon={MessageSquare}
            label="Total Messages"
            value={data.summary?.total_messages}
            trend={data.summary?.incoming_messages ? `${data.summary.incoming_messages} incoming` : undefined}
          />
          <KPICard
            icon={Users}
            label="Active Customers"
            value={data.summary?.active_customers}
            trend="Unique conversations"
          />
          <KPICard
            icon={MessageSquare}
            label="Incoming Messages"
            value={data.summary?.incoming_messages}
          />
          <KPICard
            icon={MessageSquare}
            label="Outgoing Messages"
            value={data.summary?.outgoing_messages}
          />
        </div>

        {/* Message Trends Chart */}
        <Card className="p-6 mb-8">
          <h3 className="font-semibold mb-4">Message Summary</h3>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-foreground/60">
              Loading...
            </div>
          ) : data.summary ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-foreground/60 mb-1">Total</p>
                <p className="text-2xl font-bold">{formatNumber(data.summary.total_messages)}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60 mb-1">Incoming</p>
                <p className="text-2xl font-bold text-blue-600">{formatNumber(data.summary.incoming_messages)}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60 mb-1">Outgoing</p>
                <p className="text-2xl font-bold text-green-600">{formatNumber(data.summary.outgoing_messages)}</p>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-foreground/60">
              No data available
            </div>
          )}
        </Card>

        {/* Information Card */}
        <Card className="p-6 bg-blue-50 border border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-900">Analytics Powered by Real Message Data</h3>
          <p className="text-sm text-blue-800">
            Your analytics dashboard shows message statistics from your workspace. Advanced analytics like sentiment analysis, customer intent detection, and sales funnel tracking are available in the advanced dashboard when messages are processed with NLP.
          </p>
        </Card>
      </div>
    </main>
  );
}

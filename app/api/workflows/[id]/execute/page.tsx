'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { MousePointerClick, Users, TrendingUp, Activity } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

export default function ButtonAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/buttons?days=${days}`);
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch button analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [days]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interaction Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze how users interact with your WhatsApp buttons and menus.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDays(d)}
              className={`px-4 ${days === d ? 'shadow-sm' : ''}`}
            >
              {d} Days
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-pulse text-lg text-muted-foreground">Loading interaction data...</div>
        </div>
      ) : !data ? (
        <div className="p-8 text-center bg-muted/20 rounded-xl border">
          Failed to load analytics data.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                  <MousePointerClick className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
                  <h3 className="text-2xl font-bold">{data.overview.totalClicks.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unique Users</p>
                  <h3 className="text-2xl font-bold">{data.overview.uniqueUsers.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Clicks/User</p>
                  <h3 className="text-2xl font-bold">
                    {data.overview.uniqueUsers > 0 
                      ? (data.overview.totalClicks / data.overview.uniqueUsers).toFixed(1) 
                      : '0'}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Trends Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Engagement Trends
                </CardTitle>
                <CardDescription>Daily button click frequency over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {data.dailyTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px' }} />
                        <Bar dataKey="clicks" name="Clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No trend data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Buttons Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Buttons</CardTitle>
                <CardDescription>Most popular interactive choices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {data.topButtons.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.topButtons} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {data.topButtons.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No button data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Highly Engaged Users</CardTitle>
              <CardDescription>Ranking of users based on their interaction frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Rank</th>
                      <th className="px-4 py-3">Phone Number</th>
                      <th className="px-4 py-3 text-right">Total Clicks</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.length > 0 ? (
                      data.topUsers.map((user: any, index: number) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">#{index + 1}</td>
                          <td className="px-4 py-3">{user.phone}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{user.clicks}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {new Date(user.last_active).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No active users found in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
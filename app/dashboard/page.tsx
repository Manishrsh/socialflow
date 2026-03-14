'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEVICE_HOME_SCREEN_KEY } from '@/lib/device-preferences';
import { ArrowRight, Zap, Users, MessageSquare, BarChart3, Send } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, workspace } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preferredPath = window.localStorage.getItem(DEVICE_HOME_SCREEN_KEY) || '/dashboard';
    if (preferredPath && preferredPath !== '/dashboard') {
      router.replace(preferredPath);
    }
  }, [router]);

  const stats = [
    {
      label: 'Total Customers',
      value: '0',
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: 'Messages This Month',
      value: '0',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      label: 'Active Automations',
      value: '0',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: 'Engagement Rate',
      value: '0%',
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  const quickActions = [
    {
      title: 'Create Automation',
      description: 'Build a new WhatsApp automation workflow',
      href: '/dashboard/automation',
      icon: <Zap className="w-6 h-6" />,
    },
    {
      title: 'Send Broadcast',
      description: 'Send a message to multiple customers',
      href: '/dashboard/broadcasts',
      icon: <Send className="w-6 h-6" />,
    },
    {
      title: 'Manage Customers',
      description: 'View and organize your customer database',
      href: '/dashboard/customers',
      icon: <Users className="w-6 h-6" />,
    },
    {
      title: 'View Analytics',
      description: 'Track performance and engagement metrics',
      href: '/dashboard/analytics',
      icon: <BarChart3 className="w-6 h-6" />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-balance">{workspace?.name || 'Welcome to WareChat'}</h1>
        <p className="text-foreground/60 mt-2">Manage your WhatsApp automation platforms</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className="text-primary/60">{stat.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="text-sm text-foreground/60 mt-1">{action.description}</p>
                  </div>
                  <div className="text-primary/60">{action.icon}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Get Started with Automations</h2>
            <p className="text-foreground/60 mt-2 max-w-lg">
              Create powerful WhatsApp workflows to engage your customers, nurture leads, and streamline your jewelry business operations.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/automation">
                Create Your First Automation <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  Zap, 
  Image as ImageIcon,
  Settings,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Send,
  Webhook,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, workspace, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedState = window.localStorage.getItem('dashboard-sidebar-collapsed');
    setSidebarCollapsed(savedState === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('dashboard-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: 'Automation Builder',
      href: '/dashboard/automation',
      icon: <Zap className="w-5 h-5" />,
      badge: 'New',
    },
    {
      name: 'Broadcasts',
      href: '/dashboard/broadcasts',
      icon: <Send className="w-5 h-5" />,
    },
    {
      name: 'Customers',
      href: '/dashboard/customers',
      icon: <Users className="w-5 h-5" />,
    },
    {
      name: 'Messages',
      href: '/dashboard/messages',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      name: 'Outbox Monitor',
      href: '/dashboard/outbox',
      icon: <Send className="w-5 h-5" />,
    },
    {
      name: 'Media Library',
      href: '/dashboard/media',
      icon: <ImageIcon className="w-5 h-5" />,
    },
    {
      name: 'Webhook Events',
      href: '/dashboard/webhooks',
      icon: <Webhook className="w-5 h-5" />,
    },
    {
      name: 'Execution Logs',
      href: '/dashboard/execution-logs',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      name: 'Integrations',
      href: '/dashboard/integrations',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg font-semibold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transform transition-all duration-300 z-50 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          sidebarCollapsed ? 'w-64 md:w-0 md:border-r-0 md:overflow-hidden' : 'w-64 md:w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <span className="text-sidebar-primary-foreground text-sm font-bold">W</span>
              </div>
              <span className="font-bold text-sidebar-foreground hidden sm:inline">WareChat</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workspace info */}
          <div className="p-4 border-b border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">Workspace</p>
            <p className="text-sm font-semibold text-sidebar-foreground mt-1">{workspace?.name || 'My Workspace'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs font-semibold bg-sidebar-primary text-sidebar-primary-foreground rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4 space-y-3">
            <div>
              <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">Account</p>
              <p className="text-sm font-semibold text-sidebar-foreground mt-1">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60">{user.email}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="border-b border-border bg-background">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-foreground"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </Button>
            </div>
            <div className="text-sm text-foreground/60">
              Welcome back, <span className="font-semibold">{user.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

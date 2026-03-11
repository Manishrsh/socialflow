'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function StatusPage() {
  const [status, setStatus] = useState({
    database: 'checking' as 'checking' | 'connected' | 'disconnected',
    api: 'checking' as 'checking' | 'connected' | 'disconnected',
    auth: 'checking' as 'checking' | 'connected' | 'disconnected',
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check API health
        const healthRes = await fetch('/api/health');
        setStatus((prev) => ({
          ...prev,
          api: healthRes.ok ? 'connected' : 'disconnected',
          database: healthRes.ok ? 'connected' : 'disconnected',
        }));

        // Check auth API
        const authRes = await fetch('/api/auth/me');
        setStatus((prev) => ({
          ...prev,
          auth: authRes.ok || authRes.status === 401 ? 'connected' : 'disconnected',
        }));
      } catch (error) {
        console.error('[v0] Status check failed:', error);
        setStatus({
          database: 'disconnected',
          api: 'disconnected',
          auth: 'disconnected',
        });
      }
    };

    checkStatus();
  }, []);

  const getIcon = (s: string) => {
    if (s === 'checking') return <Loader2 className="w-5 h-5 animate-spin" />;
    if (s === 'connected') return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <AlertCircle className="w-5 h-5 text-amber-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">WareChat Pro Status</h1>
          <p className="text-muted-foreground">System health and configuration status</p>
        </div>

        {/* Status Grid */}
        <div className="grid gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">API Server</h3>
                <p className="text-sm text-muted-foreground">Next.js API endpoints</p>
              </div>
              {getIcon(status.api)}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Database</h3>
                <p className="text-sm text-muted-foreground">Neon PostgreSQL connection</p>
              </div>
              {getIcon(status.database)}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Authentication</h3>
                <p className="text-sm text-muted-foreground">JWT token verification</p>
              </div>
              {getIcon(status.auth)}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Getting Started</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>✓ Try the <Link href="/welcome" className="underline hover:no-underline">Welcome Page</Link></li>
            <li>✓ Create an account at <Link href="/register" className="underline hover:no-underline">/register</Link></li>
            <li>✓ Login at <Link href="/login" className="underline hover:no-underline">/login</Link></li>
            <li>✓ View the dashboard at <Link href="/dashboard" className="underline hover:no-underline">/dashboard</Link></li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Link href="/welcome">
            <Button>View Welcome Page</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Register</Button>
          </Link>
        </div>

        {/* Info */}
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-3">About This Application</h3>
          <p className="text-sm text-muted-foreground mb-3">
            WareChat Pro is a professional WhatsApp automation platform for jewelry businesses. It features:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Visual workflow builder with 18+ node types</li>
            <li>• Customer management and CRM features</li>
            <li>• WhatsApp integration via n8n</li>
            <li>• Real-time analytics and reporting</li>
            <li>• Media library and broadcast campaigns</li>
            <li>• Enterprise-grade security and authentication</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

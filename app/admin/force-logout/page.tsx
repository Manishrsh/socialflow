'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function ForceLogoutPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [forceLogoutStatus, setForceLogoutStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check current force logout status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/auth/force-logout-all');
        if (response.ok) {
          const data = await response.json();
          setForceLogoutStatus(data);
        }
      } catch (err) {
        console.error('[v0] Error checking force logout status:', err);
      }
    };

    checkStatus();
  }, []);

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

  const handleForceLogout = async () => {
    if (!window.confirm('⚠️  WARNING: This will force logout ALL users in the system immediately. They will need to login again. Continue?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/force-logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to force logout users');
      }

      const data = await response.json();
      setSuccess(`✅ ${data.message} All users must login again.`);
      setForceLogoutStatus({ ...forceLogoutStatus, timestamp: data.timestamp });
    } catch (err: any) {
      setError(`❌ Error: ${err.message}`);
      console.error('[v0] Force logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Force Logout Control</h1>
          <p className="text-slate-300">Manage system-wide user sessions</p>
        </div>

        {/* Current User Info */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-2">Logged in as:</h2>
          <p className="text-slate-300">
            <strong>{user.name}</strong> ({user.email})
          </p>
        </div>

        {/* Force Logout Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Current Status</h2>
          {forceLogoutStatus && (
            <div>
              {forceLogoutStatus.status === 'active' ? (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                  <p className="font-semibold mb-1">🔴 FORCE LOGOUT ACTIVE</p>
                  <p className="text-sm">
                    Last triggered: {new Date(forceLogoutStatus.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm mt-2">
                    All users must re-authenticate to access the system.
                  </p>
                </div>
              ) : (
                <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
                  <p className="font-semibold mb-1">🟢 NO ACTIVE FORCE LOGOUT</p>
                  <p className="text-sm">Users can access the system normally.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Force Logout Button */}
        <div className="bg-slate-800 rounded-lg p-6 border border-red-500/50 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">🚨 Force Logout All Users</h2>
            <p className="text-slate-300 text-sm mb-4">
              This action will immediately invalidate all active user sessions. All users will be required to login again. Use this only when necessary for security reasons.
            </p>
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm">
                <strong>⚠️ Warning:</strong> This cannot be undone. All users will lose their sessions.
              </p>
            </div>
          </div>

          <Button
            onClick={handleForceLogout}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Processing...' : '🚪 Force Logout ALL Users Now'}
          </Button>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Info Section */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">ℹ️ How It Works</h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex gap-2">
              <span>1.</span>
              <span>When you click "Force Logout ALL Users", a timestamp is recorded in the system.</span>
            </li>
            <li className="flex gap-2">
              <span>2.</span>
              <span>All existing user authentication tokens issued before this time become invalid.</span>
            </li>
            <li className="flex gap-2">
              <span>3.</span>
              <span>Users accessing the system will be automatically logged out and sent to the login page.</span>
            </li>
            <li className="flex gap-2">
              <span>4.</span>
              <span>Users must re-enter their credentials to regain access to the system.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

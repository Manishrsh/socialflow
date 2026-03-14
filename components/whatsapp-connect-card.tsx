'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { MessageCircle, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface WhatsAppConnection {
  id: string;
  phone_number: string;
  account_name: string;
  business_account_id: string;
  access_token: string;
  connected_at: string;
  profile_picture_url?: string;
  is_active: boolean;
}

export function WhatsAppConnectCard() {
  const { workspace, user } = useAuth();
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing connection on mount
  useEffect(() => {
    if (!workspace?.id) return;
    loadConnection();
  }, [workspace?.id]);

  const loadConnection = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/integrations/facebook-whatsapp?workspaceId=${workspace?.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connection) {
          setConnection(data.connection);
        }
      }
    } catch (err) {
      console.error('[v0] Failed to load WhatsApp connection:', err);
      setError('Failed to load connection status');
    } finally {
      setIsLoading(false);
    }
  };

  const initiateMobileSignup = () => {
    if (!workspace?.id) {
      toast.error('Workspace not found');
      return;
    }

    setIsConnecting(true);
    
    // Get the signup URL from the backend
    fetch(`/api/integrations/facebook-whatsapp/signup-url?workspaceId=${workspace.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          // Open embedded signup in popup
          const popup = window.open(
            data.url,
            'whatsapp-signup',
            'width=600,height=700,top=100,left=100'
          );

          // Listen for completion
          const checkPopupClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkPopupClosed);
              setIsConnecting(false);
              // Reload connection after popup closes
              setTimeout(() => loadConnection(), 1000);
            }
          }, 1000);
        } else {
          toast.error('Unable to get signup URL');
          setIsConnecting(false);
        }
      })
      .catch(err => {
        console.error('[v0] Error getting signup URL:', err);
        toast.error('Failed to initiate connection');
        setIsConnecting(false);
      });
  };

  const handleVerify = async () => {
    if (!connection?.id) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/integrations/facebook-whatsapp/verify?connectionId=${connection.id}`,
        { method: 'GET' }
      );

      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection);
        toast.success('Connection verified successfully');
      } else {
        toast.error('Verification failed');
      }
    } catch (err) {
      console.error('[v0] Verification error:', err);
      toast.error('Failed to verify connection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection?.id) return;

    if (!confirm('Are you sure you want to disconnect this WhatsApp account?')) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/integrations/facebook-whatsapp/${connection.id}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setConnection(null);
        toast.success('WhatsApp account disconnected');
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (err) {
      console.error('[v0] Disconnect error:', err);
      toast.error('Failed to disconnect account');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !connection) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center min-h-32">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
            <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">WhatsApp Business Account</h3>
            <p className="text-sm text-foreground/60">Connect your WhatsApp for messaging automation</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {!connection ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground/70">
            Connect your WhatsApp Business Account to enable automated messaging, broadcasts, and customer management through your workspace.
          </p>
          <Button
            onClick={initiateMobileSignup}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Connecting...
              </>
            ) : (
              'Connect WhatsApp Account'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connected Account Info */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start justify-between mb-4">
              <Badge className="bg-green-600 hover:bg-green-700">Connected</Badge>
              <span className="text-xs text-foreground/60">
                Connected {new Date(connection.connected_at).toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-3">
              {connection.profile_picture_url && (
                <div className="flex justify-center mb-3">
                  <img
                    src={connection.profile_picture_url}
                    alt={connection.account_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
              )}

              <div>
                <p className="text-xs text-foreground/60 uppercase tracking-wider">Account Name</p>
                <p className="font-semibold text-foreground">{connection.account_name}</p>
              </div>

              <div>
                <p className="text-xs text-foreground/60 uppercase tracking-wider">Phone Number</p>
                <p className="font-semibold text-foreground">{connection.phone_number}</p>
              </div>

              <div>
                <p className="text-xs text-foreground/60 uppercase tracking-wider">Business Account ID</p>
                <p className="font-mono text-sm text-foreground/70 break-all">{connection.business_account_id}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleVerify}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Verify Connection
                </>
              )}
            </Button>

            <Button
              onClick={handleDisconnect}
              disabled={isLoading}
              variant="destructive"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { MessageCircle, RefreshCw, Trash2, AlertCircle, Send, PlusCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from WareChat! Let me know if you receive this.');
  const [isTestingMessage, setIsTestingMessage] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);

  const [metaConfig, setMetaConfig] = useState<{ appId: string, configId: string } | null>(null);

  // Load existing connection on mount
  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false);
      return;
    }
    loadConnection();
  }, [workspace?.id]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Listen for embedded signup POST messages from Facebook SDK
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (err) {
        console.debug('[v0] Unable to parse message event data', err);
        return;
      }

      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      console.log('[v0] FB embedded signup event:', data);

      if (!workspace?.id) return;

      // Only handle success events
      if (!['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'].includes(data.event)) {
        console.log('[v0] Embedded signup event not finish:', data.event);
        return;
      }

      setIsConnecting(true);

      try {
        const payload = {
          workspaceId: workspace.id,
          eventData: data.data || {},
          access_token: data.data?.access_token || '',
          phone_number_id: data.data?.phone_number_id || '',
          business_id: data.data?.business_id || '',
          waba_id: data.data?.waba_id || '',
        };

        const res = await fetch('/api/integrations/facebook-whatsapp/embed-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (res.ok && result.success) {
          await loadConnection();
          toast.success('WhatsApp account connected successfully!');
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
        } else {
          console.error('[v0] Embedded signup save failed:', result);
          toast.error('Failed to save WhatsApp connection');
        }
      } catch (err) {
        console.error('[v0] Embedded signup handler error:', err);
        toast.error('Failed to process WhatsApp connection');
      } finally {
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [workspace?.id]);

  const loadConnection = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[v0] Loading WhatsApp connection for workspace:', workspace?.id);
      const res = await fetch(`/api/integrations/facebook-whatsapp?workspaceId=${workspace?.id}`);
      const data = await res.json();
      console.log('[v0] Connection data received:', data);
      console.log('[v0] Connection object:', data.connection);
      if (data.connection) {
        console.log('[v0] Phone number:', data.connection.phone_number);
        console.log('[v0] Business account ID:', data.connection.business_account_id);
        console.log('[v0] Account name:', data.connection.account_name);
        setConnection(data.connection);
        console.log('[v0] Connection found:', data.connection);
      } else {
        setConnection(null);
        console.log('[v0] No connection found');
      }

      // Pre-fetch App Config and pre-load SDK
      if (!metaConfig) {
        try {
          const configRes = await fetch(`/api/integrations/facebook-whatsapp/signup-url?workspaceId=${workspace?.id}`);
          const configData = await configRes.json();
          if (configData.appId && configData.configId) {
            setMetaConfig({ appId: configData.appId, configId: configData.configId });

            // Ensure FB SDK is loaded
            if (!(window as any).FB) {
              (window as any).fbAsyncInit = function () {
                (window as any).FB.init({
                  appId: configData.appId,
                  cookie: true,
                  xfbml: true,
                  version: 'v21.0'
                });
                console.log('[v0] FB SDK Initialized');
              };

              (function (d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) { return; }
                js = d.createElement(s) as HTMLScriptElement; js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                if (fjs && fjs.parentNode) {
                  fjs.parentNode.insertBefore(js, fjs);
                } else {
                  d.head.appendChild(js);
                }
              }(document, 'script', 'facebook-jssdk'));
            } else {
              // Note: If already initialized with another appId, this might have no effect, 
              // but it's good practice.
              (window as any).FB.init({
                appId: configData.appId,
                cookie: true,
                xfbml: true,
                version: 'v21.0'
              });
            }
          }
        } catch (err) {
          console.error('[v0] Error getting config:', err);
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

    if (!metaConfig || !metaConfig.appId || !metaConfig.configId) {
      toast.error('Missing Meta config. Please wait or check your variables.');
      return;
    }

    if (!(window as any).FB) {
      toast.error('Facebook SDK is still loading or failed to load. Please try again or disable adblockers.');
      return;
    }

    setIsConnecting(true);
    try {
      launchFBLogin(metaConfig.configId);
    } catch (e) {
      console.error(e);
      toast.error('Error launching Facebook login');
      setIsConnecting(false);
    }
  };

  const launchFBLogin = (configId: string) => {
    (window as any).FB.login((response: any) => {
      if (response.authResponse && response.authResponse.code) {
        toast.info('Authenticating with Meta...');
        const code = response.authResponse.code;

        fetch('/api/integrations/facebook-whatsapp/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: workspace?.id,
            code: code,
          })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              toast.success('WhatsApp account connected successfully!');
              loadConnection();
            } else {
              console.error('[v0] Token exchange error:', data);
              toast.error(data.error || 'Failed to connect WhatsApp account');
            }
          })
          .catch(err => {
            console.error('[v0] Exchange error:', err);
            toast.error('Error during token exchange');
          })
          .finally(() => {
            setIsConnecting(false);
          });
      } else {
        toast.error('Login cancelled or failed');
        console.error('FB Login response without code:', response);
        setIsConnecting(false);
      }
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        feature: "whatsapp_embedded_signup"
      }
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

  const handleSendTestMessage = async () => {
    if (!workspace?.id || !testPhone) {
      toast.error('Please enter a phone number format: e.g. 1234567890');
      return;
    }
    setIsTestingMessage(true);
    try {
      const res = await fetch('/api/integrations/facebook-whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          phone: testPhone.replace(/[^0-9]/g, ''),
          message: testMessage,
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Test message sent successfully!');
        setTestPhone('');
        setShowTestForm(false);
      } else {
        toast.error(data.error || 'Failed to send test message');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred');
    } finally {
      setIsTestingMessage(false);
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
                <p className="font-semibold text-foreground">{connection.account_name || 'WhatsApp Business Account'}</p>
              </div>

              {connection.phone_number && (
                <div>
                  <p className="text-xs text-foreground/60 uppercase tracking-wider">Phone Number</p>
                  <p className="font-semibold text-foreground">{connection.phone_number}</p>
                </div>
              )}

              {connection.business_account_id && (
                <div>
                  <p className="text-xs text-foreground/60 uppercase tracking-wider">Business Account ID</p>
                  <p className="font-mono text-sm text-foreground/70 break-all">{connection.business_account_id}</p>
                </div>
              )}
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

          <div className="pt-4 border-t border-border mt-4">
            {!showTestForm ? (
              <Button variant="outline" onClick={() => setShowTestForm(true)} className="w-full border-dashed">
                <Send className="w-4 h-4 mr-2 text-primary" />
                Send a Test Message (Meta App Review)
              </Button>
            ) : (
              <div className="bg-muted/30 p-4 border rounded-xl space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" /> Send Demo Message
                </h4>
                <div>
                  <label className="text-xs text-foreground/60 mb-1 block">Phone Number (include country code)</label>
                  <Input
                    placeholder="e.g. 14155552671"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground/60 mb-1 block">Message</label>
                  <textarea
                    className="w-full text-sm p-2 bg-background border rounded-md"
                    rows={2}
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowTestForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSendTestMessage} disabled={isTestingMessage || !testPhone}>
                    {isTestingMessage ? <Spinner className="w-3 h-3 mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                    Send Message
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

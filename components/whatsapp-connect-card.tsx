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
import WhatsAppSignup from './whatsapp_main';

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
      // Allow messages from our own origin or facebook
      if (typeof event.data !== 'object') return;

      if (event.data?.type === 'WA_CALLBACK_SUCCESS') {
        console.log('[v0] Success message received from popup callback');
        toast.success('WhatsApp account connected successfully!');
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
        await loadConnection();
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

      // Pre-fetch App Config
      if (!metaConfig) {
        try {
          const configRes = await fetch(`/api/integrations/facebook-whatsapp/signup-url?workspaceId=${workspace?.id}`);
          const configData = await configRes.json();
          if (configData.appId && configData.configId) {
            setMetaConfig({ appId: configData.appId, configId: configData.configId });
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

    setIsConnecting(true);

    // Ensure we use the proper callback/origin URL (localhost or vercel domain)
    // The onboard flow mandates a redirect_uri. We point it to our backend callback which will securely exchange the token and close the popup.
    const callbackUrl = `${window.location.origin}/api/integrations/facebook-whatsapp/embed-callback`;
    const state = encodeURIComponent(workspace.id);

    const popupUrl =
      `https://business.facebook.com/messaging/whatsapp/onboard/` +
      `?app_id=${metaConfig.appId}` +
      `&config_id=${metaConfig.configId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${state}` +
      `&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D`;

    // Open synchronously to bypass browser popup blockers
    popupRef.current = window.open(
      popupUrl,
      'whatsapp-signup',
      'width=600,height=700,top=100,left=100'
    );

    // Safety check - reset isConnecting if popup closed without completing
    const checkPopupClosed = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkPopupClosed);
        setTimeout(() => {
          setIsConnecting(false);
          loadConnection();
        }, 1000);
      }
    }, 1000);
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
    // <Card className="p-6">
    //   <div className="flex items-start justify-between mb-6">
    //     <div className="flex items-center gap-3">
    //       <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
    //         <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
    //       </div>
    //       <div>
    //         <h3 className="font-semibold text-lg">WhatsApp Business Account</h3>
    //         <p className="text-sm text-foreground/60">Connect your WhatsApp for messaging automation</p>
    //       </div>
    //     </div>
    //   </div>

    //   {error && (
    //     <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
    //       <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
    //       <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
    //     </div>
    //   )}

    //   {!connection ? (
    //     <div className="space-y-4">
    //       <p className="text-sm text-foreground/70">
    //         Connect your WhatsApp Business Account to enable automated messaging, broadcasts, and customer management through your workspace.
    //       </p>
    //       <Button
    //         onClick={initiateMobileSignup}
    //         disabled={isConnecting}
    //         className="w-full"
    //         size="lg"
    //       >
    //         {isConnecting ? (
    //           <>
    //             <Spinner className="w-4 h-4 mr-2" />
    //             Connecting...
    //           </>
    //         ) : (
    //           'Connect WhatsApp Account'
    //         )}
    //       </Button>
    //     </div>
    //   ) : (
    //     <div className="space-y-6">
    //       {/* Connected Account Info */}
    //       <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
    //         <div className="flex items-start justify-between mb-4">
    //           <Badge className="bg-green-600 hover:bg-green-700">Connected</Badge>
    //           <span className="text-xs text-foreground/60">
    //             Connected {new Date(connection.connected_at).toLocaleDateString()}
    //           </span>
    //         </div>

    //         <div className="space-y-3">
    //           {connection.profile_picture_url && (
    //             <div className="flex justify-center mb-3">
    //               <img
    //                 src={connection.profile_picture_url}
    //                 alt={connection.account_name}
    //                 className="w-16 h-16 rounded-full object-cover"
    //               />
    //             </div>
    //           )}

    //           <div>
    //             <p className="text-xs text-foreground/60 uppercase tracking-wider">Account Name</p>
    //             <p className="font-semibold text-foreground">{connection.account_name || 'WhatsApp Business Account'}</p>
    //           </div>

    //           {connection.phone_number && (
    //             <div>
    //               <p className="text-xs text-foreground/60 uppercase tracking-wider">Phone Number</p>
    //               <p className="font-semibold text-foreground">{connection.phone_number}</p>
    //             </div>
    //           )}

    //           {connection.business_account_id && (
    //             <div>
    //               <p className="text-xs text-foreground/60 uppercase tracking-wider">Business Account ID</p>
    //               <p className="font-mono text-sm text-foreground/70 break-all">{connection.business_account_id}</p>
    //             </div>
    //           )}
    //         </div>
    //       </div>

    //       {/* Action Buttons */}
    //       <div className="flex gap-3">
    //         <Button
    //           onClick={handleVerify}
    //           disabled={isLoading}
    //           variant="outline"
    //           className="flex-1"
    //         >
    //           {isLoading ? (
    //             <>
    //               <Spinner className="w-4 h-4 mr-2" />
    //               Verifying...
    //             </>
    //           ) : (
    //             <>
    //               <RefreshCw className="w-4 h-4 mr-2" />
    //               Verify Connection
    //             </>
    //           )}
    //         </Button>

    //         <Button
    //           onClick={handleDisconnect}
    //           disabled={isLoading}
    //           variant="destructive"
    //           className="flex-1"
    //         >
    //           {isLoading ? (
    //             <>
    //               <Spinner className="w-4 h-4 mr-2" />
    //               Disconnecting...
    //             </>
    //           ) : (
    //             <>
    //               <Trash2 className="w-4 h-4 mr-2" />
    //               Disconnect
    //             </>
    //           )}
    //         </Button>
    //       </div>

    //       <div className="pt-4 border-t border-border mt-4">
    //         {!showTestForm ? (
    //           <Button variant="outline" onClick={() => setShowTestForm(true)} className="w-full border-dashed">
    //             <Send className="w-4 h-4 mr-2 text-primary" />
    //             Send a Test Message (Meta App Review)
    //           </Button>
    //         ) : (
    //           <div className="bg-muted/30 p-4 border rounded-xl space-y-3">
    //             <h4 className="font-semibold text-sm flex items-center gap-2">
    //               <Send className="w-4 h-4 text-primary" /> Send Demo Message
    //             </h4>
    //             <div>
    //               <label className="text-xs text-foreground/60 mb-1 block">Phone Number (include country code)</label>
    //               <Input
    //                 placeholder="e.g. 14155552671"
    //                 value={testPhone}
    //                 onChange={e => setTestPhone(e.target.value)}
    //               />
    //             </div>
    //             <div>
    //               <label className="text-xs text-foreground/60 mb-1 block">Message</label>
    //               <textarea
    //                 className="w-full text-sm p-2 bg-background border rounded-md"
    //                 rows={2}
    //                 value={testMessage}
    //                 onChange={e => setTestMessage(e.target.value)}
    //               />
    //             </div>
    //             <div className="flex gap-2 justify-end">
    //               <Button variant="ghost" size="sm" onClick={() => setShowTestForm(false)}>Cancel</Button>
    //               <Button size="sm" onClick={handleSendTestMessage} disabled={isTestingMessage || !testPhone}>
    //                 {isTestingMessage ? <Spinner className="w-3 h-3 mr-2" /> : <Send className="w-3 h-3 mr-2" />}
    //                 Send Message
    //               </Button>
    //             </div>
    //           </div>
    //         )}
    //       </div>
    //     </div>
    //   )}
    // </Card>
    <>
      <WhatsAppSignup />
    </>
  );
}

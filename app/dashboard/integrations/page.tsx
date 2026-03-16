'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Webhook, Send, Star, Trash2 } from 'lucide-react';

export default function IntegrationsPage() {
  const { workspace } = useAuth();
  const [copied, setCopied] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from Own BSP.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<string | null>(null);
  const [metaConfig, setMetaConfig] = useState<any>(null);
  const [metaApps, setMetaApps] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [ownBspConfig, setOwnBspConfig] = useState({
    executionMode: 'simulate',
    autoProcess: true,
    providerSendUrl: '',
    providerTimeoutMs: 15000,
  });
  const [isSavingOwnBspConfig, setIsSavingOwnBspConfig] = useState(false);
  const [isSavingMetaApp, setIsSavingMetaApp] = useState(false);
  const [isOpeningEmbeddedSignup, setIsOpeningEmbeddedSignup] = useState(false);
  const [metaForm, setMetaForm] = useState({
    name: '',
    appId: '',
    appSecret: '',
    configId: '',
    redirectUri: '',
    businessId: '',
    webhookVerifyToken: '',
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    instagramBusinessAccountId: '',
    instagramAccessToken: '',
    isDefault: true,
  });

  const bspWebhookBase =
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}` +
    `/api/webhooks/bsp/${workspace?.id || '{workspaceId}'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bspWebhookBase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Failed to copy URL');
    }
  };

  const handleCopyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('Copied');
    } catch {
      alert('Failed to copy');
    }
  };

  const handleOpenEmbeddedSignupPopup = () => {
    const signupUrl = String(metaConfig?.urls?.whatsappEmbeddedSignupUrl || '').trim();
    if (!signupUrl) {
      alert('Embedded signup URL is not ready. Add default Meta app with App ID + Config ID first.');
      return;
    }

    setIsOpeningEmbeddedSignup(true);
    try {
      const width = 980;
      const height = 760;
      const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
      const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
      const features = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'resizable=yes',
        'scrollbars=yes',
        'status=no',
        'toolbar=no',
        'menubar=no',
      ].join(',');

      const popup = window.open(signupUrl, 'meta_embedded_signup', features);
      if (!popup) {
        alert('Popup blocked. Please allow popups for this site and try again.');
      } else {
        popup.focus();
      }
    } finally {
      setIsOpeningEmbeddedSignup(false);
    }
  };

  const handleTestSend = async () => {
    if (!workspace?.id) {
      alert('Workspace not found');
      return;
    }
    if (!testPhone.trim() || !testMessage.trim()) {
      alert('Phone and message are required');
      return;
    }

    setIsSendingTest(true);
    setTestSendResult(null);
    try {
      const response = await fetch('/api/integrations/own-bsp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          phone: testPhone.trim(),
          message: testMessage.trim(),
          channel: 'whatsapp',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to queue test message');
      }
      setTestSendResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setTestSendResult(`Error: ${error?.message || 'Failed to queue test message'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const loadMetaData = async () => {
    if (!workspace?.id) {
      setMetaConfig(null);
      setMetaApps([]);
      return;
    }

    try {
      const [configRes, appsRes, ownBspConfigRes, onboardingRes] = await Promise.all([
        fetch(`/api/integrations/meta/config?workspaceId=${workspace.id}`),
        fetch(`/api/integrations/meta/apps?workspaceId=${workspace.id}`),
        fetch(`/api/integrations/own-bsp/config?workspaceId=${workspace.id}`),
        fetch(`/api/integrations/onboarding/status?workspaceId=${workspace.id}`),
      ]);

      const configData = await configRes.json();
      const appsData = await appsRes.json();
      const ownBspConfigData = await ownBspConfigRes.json();
      const onboardingData = await onboardingRes.json();

      setMetaConfig(configData);
      setMetaApps(Array.isArray(appsData?.apps) ? appsData.apps : []);
      setOnboarding(onboardingData?.success ? onboardingData : null);
      if (ownBspConfigData?.config) {
        setOwnBspConfig({
          executionMode: ownBspConfigData.config.executionMode || 'simulate',
          autoProcess: !!ownBspConfigData.config.autoProcess,
          providerSendUrl: ownBspConfigData.config.providerSendUrl || '',
          providerTimeoutMs: Number(ownBspConfigData.config.providerTimeoutMs || 15000),
        });
      }
    } catch {
      setMetaConfig(null);
      setMetaApps([]);
      setOnboarding(null);
    }
  };

  useEffect(() => {
    loadMetaData();
  }, [workspace?.id]);

  const handleSaveOwnBspConfig = async () => {
    if (!workspace?.id) {
      alert('Workspace not found');
      return;
    }
    setIsSavingOwnBspConfig(true);
    try {
      const response = await fetch('/api/integrations/own-bsp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          executionMode: ownBspConfig.executionMode,
          autoProcess: ownBspConfig.autoProcess,
          providerSendUrl: ownBspConfig.providerSendUrl,
          providerTimeoutMs: ownBspConfig.providerTimeoutMs,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to save delivery config');
      if (data?.config) {
        setOwnBspConfig({
          executionMode: data.config.executionMode || 'simulate',
          autoProcess: !!data.config.autoProcess,
          providerSendUrl: data.config.providerSendUrl || '',
          providerTimeoutMs: Number(data.config.providerTimeoutMs || 15000),
        });
      }
      alert('Delivery config saved');
      await loadMetaData();
    } catch (error: any) {
      alert(error?.message || 'Failed to save delivery config');
    } finally {
      setIsSavingOwnBspConfig(false);
    }
  };

  const handleQuickEnableMetaMode = async () => {
    if (!workspace?.id) {
      alert('Workspace not found');
      return;
    }
    setIsSavingOwnBspConfig(true);
    try {
      const response = await fetch('/api/integrations/own-bsp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          executionMode: 'meta',
          autoProcess: true,
          providerSendUrl: ownBspConfig.providerSendUrl,
          providerTimeoutMs: ownBspConfig.providerTimeoutMs,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to enable Meta mode');
      if (data?.config) {
        setOwnBspConfig({
          executionMode: data.config.executionMode || 'meta',
          autoProcess: !!data.config.autoProcess,
          providerSendUrl: data.config.providerSendUrl || '',
          providerTimeoutMs: Number(data.config.providerTimeoutMs || 15000),
        });
      }
      await loadMetaData();
      alert('Meta mode enabled');
    } catch (error: any) {
      alert(error?.message || 'Failed to enable Meta mode');
    } finally {
      setIsSavingOwnBspConfig(false);
    }
  };

  const handleAddMetaApp = async () => {
    if (!workspace?.id) {
      alert('Workspace not found');
      return;
    }
    if (!metaForm.name.trim() || !metaForm.appId.trim()) {
      alert('Meta app name and app ID are required');
      return;
    }

    setIsSavingMetaApp(true);
    try {
      const response = await fetch('/api/integrations/meta/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          ...metaForm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to add Meta app');

      setMetaForm({
        name: '',
        appId: '',
        appSecret: '',
        configId: '',
        redirectUri: '',
        businessId: '',
        webhookVerifyToken: '',
        whatsappPhoneNumberId: '',
        whatsappAccessToken: '',
        instagramBusinessAccountId: '',
        instagramAccessToken: '',
        isDefault: metaApps.length === 0,
      });
      await loadMetaData();
    } catch (error: any) {
      alert(error?.message || 'Failed to add Meta app');
    } finally {
      setIsSavingMetaApp(false);
    }
  };

  const handleSetDefaultMetaApp = async (appRecordId: string) => {
    if (!workspace?.id) return;
    try {
      const response = await fetch('/api/integrations/meta/apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          appRecordId,
          action: 'set_default',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to set default');
      await loadMetaData();
    } catch (error: any) {
      alert(error?.message || 'Failed to set default app');
    }
  };

  const handleDeleteMetaApp = async (appRecordId: string) => {
    if (!workspace?.id) return;
    try {
      const response = await fetch('/api/integrations/meta/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          appRecordId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to delete app');
      await loadMetaData();
    } catch (error: any) {
      alert(error?.message || 'Failed to delete app');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-foreground/60 mt-2">Connect your WhatsApp Business Account to start sending messages.</p>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Webhook className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold">WhatsApp Integration</h2>
          <p className="text-center text-foreground/60 max-w-md mb-6">
            To start using our platform, you need to connect your WhatsApp Business Account.
          </p>

          <Button
            size="lg"
            className="w-full sm:w-auto px-8 py-6 text-lg"
            disabled={!metaConfig?.urls?.whatsappEmbeddedSignupUrl || isOpeningEmbeddedSignup}
            onClick={handleOpenEmbeddedSignupPopup}
          >
            {isOpeningEmbeddedSignup ? 'Opening...' : 'Connect WhatsApp'}
          </Button>

          {!metaConfig?.urls?.whatsappEmbeddedSignupUrl && (
            <p className="text-sm text-amber-600 mt-4 text-center">
              System is not fully configured for embedded signup yet. Please configure the default Meta app in the backend.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}


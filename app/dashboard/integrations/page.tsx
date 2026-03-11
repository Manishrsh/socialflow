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
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-foreground/60 mt-2">Own BSP mode enabled. External provider controls are disabled.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Webhook className="w-5 h-5" />
          <h2 className="text-xl font-semibold">SaaS Onboarding Wizard</h2>
        </div>
        {!onboarding ? (
          <div className="text-sm text-foreground/60">Loading onboarding status...</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm">
              Progress: <span className="font-semibold">{onboarding?.progress?.percent || 0}%</span>{' '}
              ({onboarding?.progress?.completedSteps || 0}/{onboarding?.progress?.totalSteps || 4})
            </div>

            <div className="space-y-2 text-sm">
              <div className={onboarding?.checks?.deliveryModeMeta ? 'text-green-600' : 'text-orange-600'}>
                1. Delivery Mode = Meta API {onboarding?.checks?.deliveryModeMeta ? '[DONE]' : '[PENDING]'}
              </div>
              <div className={onboarding?.checks?.hasDefaultMetaApp && onboarding?.checks?.hasWhatsappCredentials ? 'text-green-600' : 'text-orange-600'}>
                2. Default Meta App + WhatsApp credentials {onboarding?.checks?.hasDefaultMetaApp && onboarding?.checks?.hasWhatsappCredentials ? '[DONE]' : '[PENDING]'}
              </div>
              <div className={onboarding?.checks?.webhookConfiguredToken ? 'text-green-600' : 'text-orange-600'}>
                3. Webhook token configured in server env {onboarding?.checks?.webhookConfiguredToken ? '[DONE]' : '[PENDING]'}
              </div>
              <div className={onboarding?.checks?.autoProcessEnabled ? 'text-green-600' : 'text-orange-600'}>
                4. Auto-process enabled {onboarding?.checks?.autoProcessEnabled ? '[DONE]' : '[PENDING]'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleQuickEnableMetaMode}>
                Enable Meta Mode
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!metaConfig?.urls?.whatsappEmbeddedSignupUrl || isOpeningEmbeddedSignup}
                onClick={handleOpenEmbeddedSignupPopup}
              >
                {isOpeningEmbeddedSignup ? 'Opening...' : 'Open Embedded Signup'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleCopyText(onboarding.webhookUrl)}>
                Copy Webhook URL
              </Button>
              <Button size="sm" variant="outline" onClick={loadMetaData}>
                Refresh Wizard
              </Button>
            </div>

            <div className="text-xs text-foreground/60">
              Next: add default Meta app below, then send a test message.
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Send className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Delivery Mode (Workspace)</h2>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={ownBspConfig.executionMode}
              onChange={(e) =>
                setOwnBspConfig((p) => ({ ...p, executionMode: e.target.value }))
              }
              className="px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="meta">Meta API (Recommended)</option>
              <option value="provider">Provider Webhook</option>
              <option value="manual">Manual Queue</option>
              <option value="simulate">Simulate (No real send)</option>
            </select>
            <Input
              type="number"
              min={1000}
              value={ownBspConfig.providerTimeoutMs}
              onChange={(e) =>
                setOwnBspConfig((p) => ({
                  ...p,
                  providerTimeoutMs: Number(e.target.value || 15000),
                }))
              }
              placeholder="Provider timeout ms"
            />
            <Input
              value={ownBspConfig.providerSendUrl}
              onChange={(e) =>
                setOwnBspConfig((p) => ({ ...p, providerSendUrl: e.target.value }))
              }
              placeholder="Provider send URL (only for provider mode)"
              className="md:col-span-2"
            />
          </div>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={ownBspConfig.autoProcess}
              onChange={(e) =>
                setOwnBspConfig((p) => ({ ...p, autoProcess: e.target.checked }))
              }
            />
            Auto process outbox
          </label>
          <Button onClick={handleSaveOwnBspConfig} disabled={isSavingOwnBspConfig}>
            {isSavingOwnBspConfig ? 'Saving...' : 'Save Delivery Config'}
          </Button>
          <div className="text-xs text-foreground/60">
            For real SaaS sending with your Meta app, use mode <code>meta</code> and set default Meta app credentials below.
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Webhook className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Meta Apps</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Meta app name"
              value={metaForm.name}
              onChange={(e) => setMetaForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="Meta app ID"
              value={metaForm.appId}
              onChange={(e) => setMetaForm((p) => ({ ...p, appId: e.target.value }))}
            />
            <Input
              placeholder="Meta app secret"
              value={metaForm.appSecret}
              onChange={(e) => setMetaForm((p) => ({ ...p, appSecret: e.target.value }))}
            />
            <Input
              placeholder="Embedded signup config ID"
              value={metaForm.configId}
              onChange={(e) => setMetaForm((p) => ({ ...p, configId: e.target.value }))}
            />
            <Input
              placeholder="Meta redirect URI"
              value={metaForm.redirectUri}
              onChange={(e) => setMetaForm((p) => ({ ...p, redirectUri: e.target.value }))}
            />
            <Input
              placeholder="Meta business ID"
              value={metaForm.businessId}
              onChange={(e) => setMetaForm((p) => ({ ...p, businessId: e.target.value }))}
            />
            <Input
              placeholder="Webhook verify token"
              value={metaForm.webhookVerifyToken}
              onChange={(e) => setMetaForm((p) => ({ ...p, webhookVerifyToken: e.target.value }))}
            />
            <Input
              placeholder="WhatsApp phone number ID"
              value={metaForm.whatsappPhoneNumberId}
              onChange={(e) => setMetaForm((p) => ({ ...p, whatsappPhoneNumberId: e.target.value }))}
            />
            <Input
              placeholder="WhatsApp access token"
              value={metaForm.whatsappAccessToken}
              onChange={(e) => setMetaForm((p) => ({ ...p, whatsappAccessToken: e.target.value }))}
            />
            <Input
              placeholder="Instagram business account ID"
              value={metaForm.instagramBusinessAccountId}
              onChange={(e) => setMetaForm((p) => ({ ...p, instagramBusinessAccountId: e.target.value }))}
            />
            <Input
              placeholder="Instagram access token"
              value={metaForm.instagramAccessToken}
              onChange={(e) => setMetaForm((p) => ({ ...p, instagramAccessToken: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={metaForm.isDefault}
                onChange={(e) => setMetaForm((p) => ({ ...p, isDefault: e.target.checked }))}
              />
              Set as default app
            </label>
            <Button onClick={handleAddMetaApp} disabled={isSavingMetaApp}>
              {isSavingMetaApp ? 'Saving...' : 'Add Meta App'}
            </Button>
          </div>

          <div className="space-y-2">
            {metaApps.length === 0 ? (
              <div className="text-sm text-foreground/60">No Meta apps added yet.</div>
            ) : (
              metaApps.map((app) => (
                <div key={app.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium">{app.name}</div>
                    <div className="text-foreground/60">App ID: {app.appId}</div>
                    <div className="text-foreground/60">Config ID: {app.configId || 'Not set'}</div>
                    <div className="text-foreground/60">Secret: {app.appSecretMasked || 'Not set'}</div>
                    <div className="text-foreground/60">WA Phone ID: {app.whatsappPhoneNumberId || 'Not set'}</div>
                    <div className="text-foreground/60">WA Token: {app.whatsappAccessTokenMasked || 'Not set'}</div>
                    <div className="text-foreground/60">IG Business ID: {app.instagramBusinessAccountId || 'Not set'}</div>
                    <div className="text-foreground/60">IG Token: {app.instagramAccessTokenMasked || 'Not set'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={app.isDefault ? 'default' : 'outline'}
                      onClick={() => handleSetDefaultMetaApp(app.id)}
                      disabled={app.isDefault}
                    >
                      <Star className="w-4 h-4 mr-1" />
                      {app.isDefault ? 'Default' : 'Set Default'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteMetaApp(app.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!metaConfig ? (
            <div className="text-sm text-foreground/60">Loading Meta config...</div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="text-sm">
                Default app status:{' '}
                <span className={metaConfig.configured ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                  {metaConfig.configured ? 'Configured' : 'Missing Keys'}
                </span>
              </div>
              {Array.isArray(metaConfig?.missing) && metaConfig.missing.length > 0 && (
                <div className="text-xs text-foreground/70">
                  Missing: {metaConfig.missing.join(', ')}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp Embedded Signup URL</label>
                <div className="flex gap-2">
                  <Input readOnly value={metaConfig?.urls?.whatsappEmbeddedSignupUrl || 'Set appId + configId in default Meta app'} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!metaConfig?.urls?.whatsappEmbeddedSignupUrl || isOpeningEmbeddedSignup}
                    onClick={handleOpenEmbeddedSignupPopup}
                  >
                    {isOpeningEmbeddedSignup ? 'Opening...' : 'Open'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!metaConfig?.urls?.whatsappEmbeddedSignupUrl}
                    onClick={() => handleCopyText(metaConfig.urls.whatsappEmbeddedSignupUrl)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Instagram Connect URL</label>
                <div className="flex gap-2">
                  <Input readOnly value={metaConfig?.urls?.instagramConnectUrl || 'Set appId + redirectUri in default Meta app'} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!metaConfig?.urls?.instagramConnectUrl}
                    onClick={() => handleCopyText(metaConfig.urls.instagramConnectUrl)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Webhook className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Own BSP Webhook</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL</label>
            <div className="flex gap-2">
              <Input readOnly value={bspWebhookBase} className="flex-1" />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? 'Copied' : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="text-xs text-foreground/60">
            Configure your provider to send events here with header <code>x-webhook-token</code>.
          </div>
          <div className="text-xs text-foreground/60">
            Optional provider selector: <code>x-bsp-provider</code> header or <code>?provider=</code> query.
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Send className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Own BSP Test Send</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <Input
              placeholder="e.g. 9198XXXXXX85"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <Input
              placeholder="Type test message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
            />
          </div>
          <Button onClick={handleTestSend} disabled={isSendingTest}>
            {isSendingTest ? 'Queuing...' : 'Queue Test Message'}
          </Button>
          {testSendResult && (
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-56">{testSendResult}</pre>
          )}
        </div>
      </Card>
    </div>
  );
}

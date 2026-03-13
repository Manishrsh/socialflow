'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DEVICE_HOME_SCREEN_KEY,
  DEVICE_HOME_SCREEN_OPTIONS,
  MOBILE_TOPBAR_HIDDEN_KEY,
} from '@/lib/device-preferences';
import { Settings, Key, Bell, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { user, workspace, setWorkspace } = useAuth();
  const [formData, setFormData] = useState({
    workspaceName: workspace?.name || '',
    whatsappPhoneNumber: '',
    webhookUrl: '',
    apiKeyMasked: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [apiKeyRaw, setApiKeyRaw] = useState('');
  const [deviceHomeScreen, setDeviceHomeScreen] = useState('/dashboard');
  const [hideMobileTopbar, setHideMobileTopbar] = useState(false);

  const loadSettings = async () => {
    if (!workspace?.id) return;
    setIsLoading(true);
    setStatusText('');
    try {
      const res = await fetch(`/api/settings/workspace?workspaceId=${workspace.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load settings');
      setFormData({
        workspaceName: data?.data?.workspaceName || workspace?.name || '',
        whatsappPhoneNumber: data?.data?.whatsappPhoneNumber || '',
        webhookUrl: data?.data?.webhookUrl || '',
        apiKeyMasked: data?.data?.apiKeyMasked || '',
      });
      if (!data?.data?.hasApiKey) {
        setApiKeyRaw('');
      }
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [workspace?.id, workspace?.name]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setDeviceHomeScreen(window.localStorage.getItem(DEVICE_HOME_SCREEN_KEY) || '/dashboard');
    setHideMobileTopbar(window.localStorage.getItem(MOBILE_TOPBAR_HIDDEN_KEY) === 'true');
  }, []);

  const saveSettings = async (regenerateApiKey: boolean) => {
    if (!workspace?.id) {
      setStatusText('Workspace not found');
      return;
    }
    setIsLoading(true);
    setStatusText('');
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          workspaceName: formData.workspaceName,
          whatsappPhoneNumber: formData.whatsappPhoneNumber,
          webhookUrl: formData.webhookUrl,
          regenerateApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save settings');
      if (regenerateApiKey) {
        setApiKeyRaw(String(data?.data?.apiKey || ''));
        setStatusText('API key regenerated');
      } else {
        setStatusText('Settings saved successfully');
      }
      if (workspace?.id && formData.workspaceName.trim()) {
        setWorkspace({ id: workspace.id, name: formData.workspaceName.trim() });
      }
      await loadSettings();
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(false);
  };

  const handleCopyApiKey = async () => {
    try {
      const keyToCopy = apiKeyRaw || formData.apiKeyMasked;
      if (!keyToCopy) {
        throw new Error('No API key found. Click Regenerate first.');
      }
      await navigator.clipboard.writeText(keyToCopy);
      setStatusText(apiKeyRaw ? 'API key copied' : 'Masked API key copied');
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to copy API key');
    }
  };

  const saveDevicePreferences = () => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(DEVICE_HOME_SCREEN_KEY, deviceHomeScreen);
    window.localStorage.setItem(MOBILE_TOPBAR_HIDDEN_KEY, String(hideMobileTopbar));
    window.dispatchEvent(new Event('storage'));
    setStatusText('This device preference saved');
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-foreground/60 mt-2">Manage your workspace and integrations</p>
        {statusText ? <p className="text-sm text-foreground/70 mt-2">{statusText}</p> : null}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Workspace Settings
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Workspace Name</label>
            <Input
              value={formData.workspaceName}
              onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          WhatsApp Integration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">WhatsApp Business Phone Number</label>
            <Input
              placeholder="+1234567890"
              value={formData.whatsappPhoneNumber}
              onChange={(e) => setFormData({ ...formData, whatsappPhoneNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL</label>
            <Input
              placeholder="https://your-domain.com/webhook"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            />
          </div>
          <Button disabled={isLoading} onClick={() => saveSettings(false)}>
            {isLoading ? 'Saving...' : 'Save WhatsApp Settings'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          API Keys
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <div className="flex gap-2">
              <Input type="password" value={formData.apiKeyMasked} readOnly className="flex-1" />
              <Button variant="outline" onClick={handleCopyApiKey} disabled={isLoading}>
                Copy
              </Button>
              <Button variant="outline" onClick={() => saveSettings(true)} disabled={isLoading}>
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
        </h2>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground/70">
            Browser push alerts work even when the site is closed after you configure
            `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            <span className="text-sm">Email notifications for new messages</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4" />
            <span className="text-sm">Daily summary of analytics</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">Workflow failure alerts</span>
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          This Device
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">First screen on this device</label>
            <select
              value={deviceHomeScreen}
              onChange={(e) => setDeviceHomeScreen(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DEVICE_HOME_SCREEN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideMobileTopbar}
              onChange={(e) => setHideMobileTopbar(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Hide top bar on mobile screen</span>
          </label>

          <Button type="button" onClick={saveDevicePreferences}>
            Save Device Preferences
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-3">Account Information</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-foreground/60">Name:</span>
            <span className="ml-2 font-medium">{user?.name}</span>
          </div>
          <div>
            <span className="text-foreground/60">Email:</span>
            <span className="ml-2 font-medium">{user?.email}</span>
          </div>
          <div>
            <span className="text-foreground/60">Plan:</span>
            <span className="ml-2 font-medium">SaaS</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

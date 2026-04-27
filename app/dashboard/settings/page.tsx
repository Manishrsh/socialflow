'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DEVICE_HOME_SCREEN_KEY,
  DEVICE_HOME_SCREEN_OPTIONS,
  MOBILE_TOPBAR_HIDDEN_KEY,
} from '@/lib/device-preferences';
import { Settings, Key, Bell, Lock, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, workspace, setWorkspace } = useAuth();
  const [formData, setFormData] = useState({
    workspaceName: workspace?.name || '',
    whatsappPhoneNumber: '',
    webhookUrl: '',
    apiKeyMasked: '',
    businessName: '',
    logoUrl: '',
    brandColorPrimary: '#1f2937',
    brandColorSecondary: '#a7f3d0',
    phoneNumber: '',
    address: '',
    socialHandle: '',
    tagline: '',
    industry: '',
    calendarPostingPaused: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [apiKeyRaw, setApiKeyRaw] = useState('');
  const [deviceHomeScreen, setDeviceHomeScreen] = useState('/dashboard');
  const [hideMobileTopbar, setHideMobileTopbar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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
        businessName: data?.data?.branding?.businessName || workspace?.name || '',
        logoUrl: data?.data?.branding?.logoUrl || '',
        brandColorPrimary: data?.data?.branding?.brandColorPrimary || '#1f2937',
        brandColorSecondary: data?.data?.branding?.brandColorSecondary || '#a7f3d0',
        phoneNumber: data?.data?.branding?.phoneNumber || data?.data?.whatsappPhoneNumber || '',
        address: data?.data?.branding?.address || '',
        socialHandle: data?.data?.branding?.socialHandle || '',
        tagline: data?.data?.branding?.tagline || '',
        industry: data?.data?.branding?.industry || '',
        calendarPostingPaused: !!data?.data?.branding?.calendarPostingPaused,
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
          businessName: formData.businessName,
          logoUrl: formData.logoUrl,
          brandColorPrimary: formData.brandColorPrimary,
          brandColorSecondary: formData.brandColorSecondary,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          socialHandle: formData.socialHandle,
          tagline: formData.tagline,
          industry: formData.industry,
          calendarPostingPaused: formData.calendarPostingPaused,
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

  const uploadLogo = async (file: File | null) => {
    if (!workspace?.id || !file) return;
    setIsUploadingLogo(true);
    setStatusText('');
    try {
      const uploadData = new FormData();
      uploadData.append('workspaceId', workspace.id);
      uploadData.append('file', file);
      uploadData.append('title', `${formData.businessName || workspace.name || 'logo'} logo`);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: uploadData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to upload logo');
      setFormData((current) => ({ ...current, logoUrl: data?.url || '' }));
      setStatusText('Logo uploaded successfully');
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
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
          <ImageIcon className="w-5 h-5" />
          Branding Settings
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Business Name</label>
              <Input
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder={workspace?.name || 'Business name'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Industry</label>
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="textile, jewellery, fashion..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Primary Brand Color</label>
              <Input
                type="color"
                value={formData.brandColorPrimary}
                onChange={(e) => setFormData({ ...formData, brandColorPrimary: e.target.value })}
                className="h-10 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Secondary Brand Color</label>
              <Input
                type="color"
                value={formData.brandColorSecondary}
                onChange={(e) => setFormData({ ...formData, brandColorSecondary: e.target.value })}
                className="h-10 w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://... or upload a logo"
                className="flex-1"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="h-4 w-4" />
                {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadLogo(e.target.files?.[0] || null)}
                  disabled={isUploadingLogo}
                />
              </label>
            </div>
            {formData.logoUrl ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <img src={formData.logoUrl} alt="Brand logo preview" className="h-14 w-14 rounded-lg object-contain bg-white p-2" />
                <div className="break-all text-sm text-foreground/70">{formData.logoUrl}</div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+91..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Instagram Handle</label>
              <Input
                value={formData.socialHandle}
                onChange={(e) => setFormData({ ...formData, socialHandle: e.target.value })}
                placeholder="@yourbrand"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Shop address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tagline</label>
            <Input
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              placeholder="Your festive sales partner"
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <div className="text-sm font-medium">Pause all Calendar posting</div>
              <div className="text-xs text-foreground/60">Stops every scheduled festival and custom event post until turned back on.</div>
            </div>
            <Switch
              checked={!formData.calendarPostingPaused}
              onCheckedChange={(checked) => setFormData({ ...formData, calendarPostingPaused: !checked })}
            />
          </label>
        </div>
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

      {/* Admin Section */}
      <Card className="p-6 border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-semibold">System Administration</h3>
            <p className="text-sm text-foreground/60 mt-1">Force logout all users (security emergency only)</p>
          </div>
        </div>
        <Link href="/admin/force-logout">
          <Button variant="destructive" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Force Logout Control
          </Button>
        </Link>
      </Card>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface WhatsAppFlowRecord {
  id?: string;
  name: string;
  description?: string | null;
  flow_type: string;
  cta_label: string;
  meta_flow_id?: string | null;
  is_active: boolean;
  config: Record<string, any>;
}

interface Props {
  workspaceId: string;
  initialFlow?: WhatsAppFlowRecord | null;
}

export function WhatsAppFlowBuilder({ workspaceId, initialFlow }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    name: initialFlow?.name || 'Appointment Booking Flow',
    description: initialFlow?.description || 'Collect appointment details inside WhatsApp',
    flowType: initialFlow?.flow_type || 'appointment',
    ctaLabel: initialFlow?.cta_label || 'Book Appointment',
    metaFlowId: initialFlow?.meta_flow_id || '',
    isActive: initialFlow?.is_active ?? true,
    introText:
      initialFlow?.config?.introText ||
      'Welcome. Please fill out this form to book your appointment.',
    successMessage:
      initialFlow?.config?.successMessage ||
      'Thanks, your appointment request has been received.',
    askName: initialFlow?.config?.askName ?? true,
    askPhone: initialFlow?.config?.askPhone ?? true,
    askService: initialFlow?.config?.askService ?? true,
    askDate: initialFlow?.config?.askDate ?? true,
    askTime: initialFlow?.config?.askTime ?? true,
    askNotes: initialFlow?.config?.askNotes ?? true,
    serviceOptions: Array.isArray(initialFlow?.config?.serviceOptions)
      ? initialFlow?.config?.serviceOptions.join('\n')
      : 'Jewellery Consultation\nRing Sizing\nCustom Order\nRepair Request',
    timeSlots: Array.isArray(initialFlow?.config?.timeSlots)
      ? initialFlow?.config?.timeSlots.join('\n')
      : '10:00 AM\n11:00 AM\n12:00 PM\n03:00 PM\n04:00 PM',
  });

  const generatedSchema = useMemo(
    () => ({
      version: 1,
      type: form.flowType,
      title: form.name,
      ctaLabel: form.ctaLabel,
      introText: form.introText,
      successMessage: form.successMessage,
      fields: [
        form.askName ? { key: 'customer_name', type: 'text', label: 'Full Name', required: true } : null,
        form.askPhone ? { key: 'customer_phone', type: 'phone', label: 'Phone Number', required: true } : null,
        form.askService
          ? {
              key: 'service',
              type: 'select',
              label: 'Service',
              required: true,
              options: form.serviceOptions.split('\n').map((item) => item.trim()).filter(Boolean),
            }
          : null,
        form.askDate ? { key: 'appointment_date', type: 'date', label: 'Preferred Date', required: true } : null,
        form.askTime
          ? {
              key: 'appointment_time',
              type: 'select',
              label: 'Preferred Time',
              required: true,
              options: form.timeSlots.split('\n').map((item) => item.trim()).filter(Boolean),
            }
          : null,
        form.askNotes ? { key: 'notes', type: 'textarea', label: 'Notes', required: false } : null,
      ].filter(Boolean),
    }),
    [form]
  );

  const updateField = (key: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        workspaceId,
        name: form.name,
        description: form.description,
        flowType: form.flowType,
        ctaLabel: form.ctaLabel,
        metaFlowId: form.metaFlowId,
        isActive: form.isActive,
        config: {
          introText: form.introText,
          successMessage: form.successMessage,
          askName: form.askName,
          askPhone: form.askPhone,
          askService: form.askService,
          askDate: form.askDate,
          askTime: form.askTime,
          askNotes: form.askNotes,
          serviceOptions: form.serviceOptions.split('\n').map((item) => item.trim()).filter(Boolean),
          timeSlots: form.timeSlots.split('\n').map((item) => item.trim()).filter(Boolean),
          generatedSchema,
        },
      };

      const response = await fetch(
        initialFlow?.id ? `/api/whatsapp-flows/${initialFlow.id}` : '/api/whatsapp-flows',
        {
          method: initialFlow?.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save flow');
      }

      router.push(
        initialFlow?.id ? `/dashboard/whatsapp-flows/${initialFlow.id}` : `/dashboard/whatsapp-flows/${data.flowId}`
      );
      router.refresh();
    } catch (error: any) {
      alert(error?.message || 'Failed to save WhatsApp flow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialFlow?.id) return;
    const confirmed = window.confirm('Delete this WhatsApp flow? This cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/whatsapp-flows/${initialFlow.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete flow');
      }

      router.push('/dashboard/whatsapp-flows');
      router.refresh();
    } catch (error: any) {
      alert(error?.message || 'Failed to delete WhatsApp flow');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 text-sm text-foreground/60">
            <Link href="/dashboard/whatsapp-flows" className="hover:text-foreground">
              WhatsApp Flows
            </Link>
            <span className="mx-2">/</span>
            <span>{initialFlow?.id ? 'Edit Flow' : 'New Flow'}</span>
          </div>
          <h1 className="text-3xl font-bold">
            {initialFlow?.id ? 'Edit WhatsApp Flow' : 'New WhatsApp Flow'}
          </h1>
          <p className="mt-2 text-foreground/60">
            Build a real appointment flow definition your team can manage from the dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {initialFlow?.id ? (
            <Button type="button" variant="outline" onClick={handleDelete} disabled={isDeleting || isSaving}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={isSaving || isDeleting}>
            {isSaving ? 'Saving...' : initialFlow?.id ? 'Save Changes' : 'Create Flow'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Flow Name</label>
              <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Flow Type</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.flowType}
                onChange={(e) => updateField('flowType', e.target.value)}
              >
                <option value="appointment">Appointment</option>
                <option value="lead_capture">Lead Capture</option>
                <option value="support">Support Intake</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">CTA Label</label>
              <Input value={form.ctaLabel} onChange={(e) => updateField('ctaLabel', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Meta Flow ID</label>
              <Input
                placeholder="Optional now. Add the real Meta Flow ID after publishing in WhatsApp Manager."
                value={form.metaFlowId}
                onChange={(e) => updateField('metaFlowId', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Intro Text</label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.introText}
                onChange={(e) => updateField('introText', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Success Message</label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.successMessage}
                onChange={(e) => updateField('successMessage', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border p-4">
            <div className="text-sm font-medium">Fields To Collect</div>
            {[
              ['askName', 'Customer Name'],
              ['askPhone', 'Phone Number'],
              ['askService', 'Service'],
              ['askDate', 'Appointment Date'],
              ['askTime', 'Appointment Time'],
              ['askNotes', 'Notes'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((form as any)[key])}
                  onChange={(e) => updateField(key, e.target.checked)}
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Service Options</label>
              <textarea
                className="min-h-40 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.serviceOptions}
                onChange={(e) => updateField('serviceOptions', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Available Time Slots</label>
              <textarea
                className="min-h-40 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.timeSlots}
                onChange={(e) => updateField('timeSlots', e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm">
            <span>Flow is active</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField('isActive', e.target.checked)}
            />
          </label>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Live Preview</h2>
              <p className="text-sm text-foreground/60">How this flow will look as an internal definition.</p>
            </div>
            <div className="rounded-3xl border bg-[#efeae2] p-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-sm font-medium">{form.name}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/75">{form.introText}</div>
                <div className="mt-4 rounded-xl bg-[#128c7e] px-4 py-2 text-center text-sm font-medium text-white">
                  {form.ctaLabel}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {generatedSchema.fields.map((field: any) => (
                <div key={field.key} className="rounded-xl border px-3 py-2">
                  {field.label}
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-6">
            <div>
              <h2 className="text-lg font-semibold">Generated Schema</h2>
              <p className="text-sm text-foreground/60">
                Saved with this record so it is real data, not just a visual mockup.
              </p>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-muted p-4 text-xs">
              {JSON.stringify(generatedSchema, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Plus, ArrowRight, CalendarRange } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WhatsAppFlowItem {
  id: string;
  name: string;
  description?: string | null;
  flow_type: string;
  cta_label: string;
  meta_flow_id?: string | null;
  is_active: boolean;
  updated_at: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load WhatsApp flows');
  }
  return data;
};

export default function WhatsAppFlowsPage() {
  const { workspace } = useAuth();
  const { data, error, isLoading } = useSWR(
    workspace ? `/api/whatsapp-flows?workspaceId=${workspace.id}` : null,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const flows: WhatsAppFlowItem[] = data?.flows || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Flows</h1>
          <p className="mt-2 text-foreground/60">
            Build and manage real appointment and intake flow definitions from the dashboard, then sync them with Meta.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/whatsapp-flows/builder">
            <Plus className="mr-2 h-4 w-4" />
            New Flow
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-sm text-foreground/60">Loading WhatsApp flows...</Card>
      ) : error ? (
        <Card className="p-8 text-sm text-destructive">{error.message}</Card>
      ) : flows.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarRange className="mx-auto mb-4 h-12 w-12 text-foreground/20" />
          <h2 className="text-xl font-semibold">No WhatsApp flows yet</h2>
          <p className="mt-2 text-foreground/60">Create your first appointment/menu flow builder record.</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/whatsapp-flows/builder">
              Create Flow <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <Link key={flow.id} href={`/dashboard/whatsapp-flows/${flow.id}`}>
              <Card className="p-6 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">{flow.name}</h2>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${flow.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {flow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground/60">{flow.description || 'No description yet.'}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground/50">
                      <span>Type: {flow.flow_type}</span>
                      <span>CTA: {flow.cta_label}</span>
                      <span>Meta Flow ID: {flow.meta_flow_id || 'Not linked yet'}</span>
                    </div>
                  </div>
                  <div className="text-xs text-foreground/50">
                    {new Date(flow.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { WhatsAppFlowBuilder } from '@/components/whatsapp-flow-builder';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load WhatsApp flow');
  }
  return data;
};

export default function WhatsAppFlowDetailPage() {
  const params = useParams<{ id: string }>();
  const { workspace } = useAuth();
  const { data, error, isLoading } = useSWR(
    params?.id ? `/api/whatsapp-flows/${params.id}` : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  if (!workspace?.id || isLoading) {
    return <Card className="p-6 text-sm text-foreground/60">Loading WhatsApp flow...</Card>;
  }

  if (error) {
    return <Card className="p-6 text-sm text-destructive">{error.message}</Card>;
  }

  return <WhatsAppFlowBuilder workspaceId={workspace.id} initialFlow={data} />;
}

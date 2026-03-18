'use client';

import { useAuth } from '@/lib/auth-context';
import { WhatsAppFlowBuilder } from '@/components/whatsapp-flow-builder';

export default function WhatsAppFlowBuilderPage() {
  const { workspace } = useAuth();

  if (!workspace?.id) {
    return <div className="text-sm text-foreground/60">Loading workspace...</div>;
  }

  return <WhatsAppFlowBuilder workspaceId={workspace.id} />;
}

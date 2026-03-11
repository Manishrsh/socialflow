'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { WorkflowBuilder } from '@/components/workflow-builder';
import { Node, Edge } from 'reactflow';

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const { workspace } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async ({
    name,
    description,
    nodes,
    edges,
  }: {
    name: string;
    description: string;
    nodes: Node[];
    edges: Edge[];
  }) => {
    if (!workspace) {
      alert('Workspace not found. Please logout/login and try again.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/workflows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'New Workflow',
          description: description || 'Created automation workflow',
          workspaceId: workspace.id,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save workflow');
      }

      const data = await response.json();
      router.push(`/dashboard/automation/${data.workflowId}`);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WorkflowBuilder
      onSave={handleSave}
      initialNodes={[]}
      initialEdges={[]}
      initialName="New Workflow"
      initialDescription="Created automation workflow"
    />
  );
}

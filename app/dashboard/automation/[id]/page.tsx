'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { WorkflowBuilder } from '@/components/workflow-builder';
import { Node, Edge } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  is_active: boolean;
  updated_at: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Request failedss');
  }
  return data;
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const [phone, setPhone] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const {
    data: workflow,
    error,
    isLoading,
    mutate: mutateWorkflow,
  } = useSWR<Workflow>(`/api/workflows/${workflowId}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 0,
  });

  const handleToggleActive = async () => {
    if (!workflow) return;

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !workflow.is_active,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update workflow status');
      }

      await mutateWorkflow();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update workflow status');
    }
  };

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
    if (!workflow) return;

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save workflow');
      }

      await mutateWorkflow();
    } catch (error) {
      console.error('Save error:', error);
      alert(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  };

  const handleExecute = async () => {
    if (!phone) {
      alert('Enter phone number to execute workflow');
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Execution failed');
      }

      alert(`Workflow executed. Steps executed: ${data.executedNodes}`);
    } catch (err: any) {
      alert(err?.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground/60">Loading workflow...</div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-destructive">{error instanceof Error ? error.message : 'Workflow not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute right-4 top-4 z-20 flex items-end gap-2 rounded-lg border bg-background/95 p-2 shadow">
        <Button variant={workflow.is_active ? 'outline' : 'default'} onClick={handleToggleActive}>
          {workflow.is_active ? 'Deactivate Flow' : 'Activate Flow'}
        </Button>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (e.g. 9198XXXXXX85)"
          className="w-56"
        />
        <Button onClick={handleExecute} disabled={isExecuting}>
          {isExecuting ? 'Executing...' : 'Run Flow'}
        </Button>
        </div>

        <WorkflowBuilder
          key={`${workflow.id}-${workflow.updated_at}`}
          workflowId={workflowId}
          initialNodes={workflow.nodes}
          initialEdges={workflow.edges}
          initialName={workflow.name}
          initialDescription={workflow.description || ''}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

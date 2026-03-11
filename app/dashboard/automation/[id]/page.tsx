'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { WorkflowBuilder } from '@/components/workflow-builder';
import { Node, Edge } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  is_active: boolean;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const { workspace } = useAuth();
  const workflowId = params.id as string;
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch workflow');
        }
        const data = await response.json();
        setWorkflow(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  const handleSave = async (nodes: Node[], edges: Edge[]) => {
    if (!workflow) return;

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflow.name,
          description: workflow.description,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save workflow');
      }

      setWorkflow((prev) =>
        prev ? { ...prev, nodes, edges } : null
      );
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
        <div className="text-destructive">{error || 'Workflow not found'}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-20 flex items-end gap-2 rounded-lg border bg-background/95 p-2 shadow">
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
        workflowId={workflowId}
        initialNodes={workflow.nodes}
        initialEdges={workflow.edges}
        onSave={handleSave}
      />
    </div>
  );
}

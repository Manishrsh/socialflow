'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Plus, Zap, ArrowRight } from 'lucide-react';
import useSWR from 'swr';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  nodes: any[];
  edges: any[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AutomationPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data, isLoading, error } = useSWR(
    workspace ? `/api/workflows/list?workspaceId=${workspace.id}` : null,
    fetcher
  );

  const workflows: Workflow[] = data?.workflows || [];
  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Builder</h1>
          <p className="text-foreground/60 mt-2">Create and manage WhatsApp workflows</p>
        </div>
        <Link href="/dashboard/automation/builder">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Input
        placeholder="Search workflows..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md"
      />

      {/* Workflows List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-foreground/60">Loading workflows...</div>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
          <p className="text-foreground/60 mb-6">Create your first automation workflow to get started</p>
          <Link href="/dashboard/automation/builder">
            <Button>
              Create First Workflow <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredWorkflows.map((workflow) => (
            <Link key={workflow.id} href={`/dashboard/automation/${workflow.id}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{workflow.name}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          workflow.is_active
                            ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-foreground/60 mt-1">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-foreground/50">
                      <span>{workflow.nodes?.length || 0} nodes</span>
                      <span>{workflow.edges?.length || 0} connections</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground/60">
                      {new Date(workflow.updated_at).toLocaleDateString()}
                    </p>
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

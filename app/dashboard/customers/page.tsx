'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Users, Mail, Phone, Tag } from 'lucide-react';
import useSWR from 'swr';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  created_at: string;
  message_count: number;
  last_message_date?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CustomersPage() {
  const { workspace } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', tags: '' });

  const { data, isLoading, mutate } = useSWR(
    workspace ? `/api/customers/list?workspaceId=${workspace.id}&search=${searchTerm}&tag=${selectedTag}` : null,
    fetcher
  );

  const customers: Customer[] = data?.customers || [];
  const allTags = Array.from(new Set(customers.flatMap((c) => c.tags)));

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspace) return;

    try {
      const response = await fetch('/api/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()) : [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to add customer');
        return;
      }

      setFormData({ name: '', phone: '', email: '', tags: '' });
      setIsDialogOpen(false);
      mutate();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to add customer');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-foreground/60 mt-2">Manage and organize your customer database</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <Input
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email (Optional)</label>
                <Input
                  placeholder="john@example.com"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                <Input
                  placeholder="vip, bulk-buyer, regular"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                Add Customer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tags filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag('')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTag === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground/70 hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTag === tag
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground/70 hover:bg-muted/80'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customers List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-foreground/60">Loading customers...</div>
        </div>
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
          <p className="text-foreground/60">Add your first customer to get started</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {customers.map((customer) => (
            <Card key={customer.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{customer.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-foreground/60">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {customer.email}
                      </div>
                    )}
                  </div>
                  {customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {customer.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded text-xs bg-muted text-foreground/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm text-foreground/60">
                  <p>{customer.message_count} messages</p>
                  {customer.last_message_date && (
                    <p className="text-xs">
                      Last: {new Date(customer.last_message_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

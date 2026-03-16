'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, LayoutTemplate, CheckCircle, Smartphone } from 'lucide-react';

interface TemplateItem {
    id: string;
    name: string;
    category: string;
    language: string;
    status: string;
    components: any[];
    created_at: string;
}

export default function TemplatesPage() {
    const { workspace } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        category: 'MARKETING',
        language: 'en_US',
        bodyText: '',
    });

    const loadTemplates = async () => {
        if (!workspace?.id) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/templates?workspaceId=${workspace.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to load templates');
            setTemplates(Array.isArray(data?.templates) ? data.templates : []);
        } catch (error: any) {
            setStatusText(error?.message || 'Failed to load templates');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, [workspace?.id]);

    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspace?.id) {
            setStatusText('Workspace not found');
            return;
        }
        setIsSubmitting(true);
        setStatusText('');

        // Convert bodyText to WhatsApp components format
        const components = [
            {
                type: 'BODY',
                text: formData.bodyText
            }
        ];

        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    name: formData.name.toLowerCase().replace(/ /g, '_'),
                    category: formData.category,
                    language: formData.language,
                    components,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to create template');

            setFormData({ name: '', category: 'MARKETING', language: 'en_US', bodyText: '' });
            setIsDialogOpen(false);
            await loadTemplates();
        } catch (error: any) {
            setStatusText(error?.message || 'Failed to create template');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Message Templates</h1>
                    <p className="text-foreground/60 mt-2">Manage your pre-approved WhatsApp message templates</p>
                    {statusText && <p className="text-sm mt-2 text-red-500">{statusText}</p>}
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Template</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateTemplate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Template Name</label>
                                <Input
                                    placeholder="e.g. welcome_message"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <p className="text-xs text-foreground/50 mt-1">Lowercase, no spaces or special chars.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Category</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-border bg-background"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="MARKETING">Marketing</option>
                                        <option value="UTILITY">Utility</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Language</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-border bg-background"
                                        value={formData.language}
                                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                    >
                                        <option value="en_US">English (US)</option>
                                        <option value="en_GB">English (UK)</option>
                                        <option value="es">Spanish</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Message Body</label>
                                <textarea
                                    placeholder="Hello {{1}}, welcome to WareChat! Your order {{2}} is confirmed."
                                    value={formData.bodyText}
                                    onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                                    className="w-full p-3 rounded-lg border border-border bg-background"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="bg-primary/5 p-4 rounded-lg mt-4">
                                <p className="text-xs text-foreground/70 mb-2 font-semibold flex items-center gap-1">
                                    <Smartphone className="w-4 h-4" /> Message Preview
                                </p>
                                <div className="text-sm bg-white dark:bg-zinc-900 border p-3 rounded-lg rounded-tl-none inline-block shadow-sm">
                                    {formData.bodyText || "Your message will appear here"}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Submit to Meta for Review'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <Card className="p-10 text-center text-foreground/60">Loading templates...</Card>
            ) : templates.length === 0 ? (
                <Card className="p-12 text-center">
                    <LayoutTemplate className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                    <p className="text-foreground/60 mb-4">Create your first template to start sending broadcasts</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => {
                        const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
                        return (
                            <Card key={template.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                                <div className="p-5 flex-1 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg truncate max-w-[200px]" title={template.name}>
                                                {template.name}
                                            </h3>
                                            <p className="text-xs bg-muted inline-flex px-2 py-0.5 rounded mt-1 font-medium">
                                                {template.category} • {template.language}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-1 rounded text-xs font-semibold">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            {template.status}
                                        </div>
                                    </div>

                                    <div className="bg-muted/50 p-4 flex-1 rounded-xl rounded-tl-sm text-sm border">
                                        {bodyComponent?.text || "No body text content"}
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-3 text-xs text-foreground/50 border-t flex justify-between items-center">
                                    <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

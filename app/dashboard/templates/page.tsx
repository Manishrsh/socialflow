'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Mail, Loader2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type TemplateComponent = {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
};

type Template = {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: TemplateComponent[];
    created_at: string;
};

export default function TemplatesPage() {
    const { workspace } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        language: 'en_US',
        category: 'MARKETING',
        bodyText: '',
    });

    useEffect(() => {
        if (workspace?.id) {
            fetchTemplates();
        }
    }, [workspace?.id]);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/templates?workspaceId=${workspace?.id}`);
            const data = await res.json();
            if (res.ok) {
                setTemplates(data.templates || []);
            } else {
                toast.error(data.error || 'Failed to fetch templates');
            }
        } catch (err) {
            toast.error('An error occurred while fetching templates');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTemplate.name || !newTemplate.bodyText) {
            toast.error('Please fill out all required fields');
            return;
        }

        // Enforce WhatsApp template name rules
        const formattedName = newTemplate.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        setIsCreating(true);
        try {
            const payload = {
                workspaceId: workspace?.id,
                name: formattedName,
                language: newTemplate.language,
                category: newTemplate.category,
                components: [
                    {
                        type: 'BODY',
                        text: newTemplate.bodyText,
                    }
                ],
            };

            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Template created successfully! (Permissions Test Passed)');
                setTemplates([data.template, ...templates]);
                setIsCreateModalOpen(false);
                setNewTemplate({ name: '', language: 'en_US', category: 'MARKETING', bodyText: '' });
            } else {
                toast.error(data.error || 'Failed to create template');
            }
        } catch (err) {
            toast.error('An error occurred');
        } finally {
            setIsCreating(false);
        }
    };

    const truncate = (str: string, length: number = 80) => {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Message Templates</h1>
                    <p className="text-muted-foreground">
                        Manage your WhatsApp Business templates (`whatsapp_business_management` scope).
                    </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Template
                </Button>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create WhatsApp Template</DialogTitle>
                        <DialogDescription>
                            Submit a new template to Meta for approval. This covers the template creation use case.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateTemplate} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Template Name</label>
                            <input
                                type="text"
                                value={newTemplate.name}
                                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                placeholder="e.g. welcome_message_1"
                                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                            <p className="text-xs text-muted-foreground">Only lowercase letters, numbers, and underscores.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Category</label>
                                <select
                                    className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newTemplate.category}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                >
                                    <option value="MARKETING">Marketing</option>
                                    <option value="UTILITY">Utility</option>
                                    <option value="AUTHENTICATION">Authentication</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Language</label>
                                <select
                                    className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newTemplate.language}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                                >
                                    <option value="en_US">English (US)</option>
                                    <option value="en_GB">English (UK)</option>
                                    <option value="es">Spanish</option>
                                    <option value="hi">Hindi</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Message Body</label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Hello {{1}}, welcome to our platform!"
                                value={newTemplate.bodyText}
                                onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
                                required
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Submit to Meta
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Loading templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center p-12 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                    <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                        You haven't created any WhatsApp message templates yet. Create one to start sending structured messages to your customers.
                    </p>
                    <Button onClick={() => setIsCreateModalOpen(true)}>Create your first template</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => {
                        const bodyComponent = template.components?.find((c) => c.type === 'BODY');
                        return (
                            <Card key={template.id} className="relative overflow-hidden group">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base break-words w-[85%]">{template.name}</CardTitle>
                                            <CardDescription className="text-xs uppercase mt-1 tracking-wider">
                                                {template.category} • {template.language}
                                            </CardDescription>
                                        </div>
                                        <span
                                            className={`text-[10px] font-bold px-2 py-1 rounded-full ${template.status === 'APPROVED' || template.status === 'APPROVED_PENDING'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500'
                                                    : template.status === 'REJECTED'
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500'
                                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500'
                                                }`}
                                        >
                                            {template.status}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-muted p-3 rounded-md text-sm text-foreground/80 line-clamp-4 relative">
                                        {bodyComponent ? bodyComponent.text : 'No body text available'}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

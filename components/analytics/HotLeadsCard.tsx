'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface HotLead {
  id: string;
  name: string;
  phone: string;
  intent_score: number;
  message_count: number;
  last_contact: string;
}

interface HotLeadsCardProps {
  leads: HotLead[];
  isLoading?: boolean;
}

export function HotLeadsCard({ leads, isLoading }: HotLeadsCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-32 rounded bg-muted" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-emerald-200 bg-emerald-50">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-emerald-900">Hot Leads</h3>
        <span className="ml-auto text-sm font-medium text-emerald-700">{leads.length}</span>
      </div>

      <div className="space-y-3">
        {leads.slice(0, 5).map((lead) => (
          <Link
            key={lead.id}
            href={`/dashboard/messages?customer=${lead.id}`}
            className="block p-3 rounded-lg bg-white hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{lead.name || 'Unknown'}</p>
                <p className="text-xs text-foreground/60">{lead.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">{Math.round(lead.intent_score * 100)}%</p>
                <p className="text-xs text-foreground/60">{lead.message_count} msgs</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {leads.length > 5 && (
        <Button variant="outline" className="w-full mt-4" size="sm">
          View All {leads.length} Leads
        </Button>
      )}
    </Card>
  );
}

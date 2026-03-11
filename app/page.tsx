'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Zap, Users, MessageSquare, BarChart3, MessageCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">W</span>
            </div>
            <span className="font-bold text-lg">WareChat Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-balance leading-tight">
            WhatsApp Automation for <span className="text-primary">Jewelry Shops</span>
          </h1>
          <p className="text-xl text-foreground/60 max-w-2xl mx-auto text-balance">
            Automate customer engagement, manage orders, and grow your jewelry business with powerful WhatsApp workflows powered by WareChat Pro.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline">
            Watch Demo
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Powerful Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Automation Builder',
              description: 'Create complex workflows with visual builder - no coding required',
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: 'Customer Management',
              description: 'Organize and segment your customer base for targeted campaigns',
            },
            {
              icon: <MessageSquare className="w-6 h-6" />,
              title: 'Broadcast Campaigns',
              description: 'Send personalized messages to thousands of customers instantly',
            },
            {
              icon: <BarChart3 className="w-6 h-6" />,
              title: 'Advanced Analytics',
              description: 'Track engagement, conversion rates, and ROI in real-time',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="text-primary mb-3">{feature.icon}</div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground/60">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Connect WhatsApp',
              description: 'Link your WhatsApp Business Account to get started',
            },
            {
              step: '2',
              title: 'Build Automations',
              description: 'Use our visual builder to create customer workflows',
            },
            {
              step: '3',
              title: 'Grow Your Business',
              description: 'Engage customers and drive sales with automation',
            },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-foreground/60">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Jewelry Business?</h2>
          <p className="text-lg text-foreground/70 mb-8 max-w-2xl mx-auto">
            Join jewelry shop owners worldwide who are using WareChat Pro to automate their WhatsApp communication and boost sales.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-foreground/60">
          <p>&copy; 2024 WareChat Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

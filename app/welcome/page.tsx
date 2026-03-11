'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Zap, Users, MessageSquare, BarChart3 } from 'lucide-react';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* Navigation */}
      <nav className="border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">W</span>
            </div>
            <span className="font-bold text-lg hidden sm:inline">WareChat Pro</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            WhatsApp Automation Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-balance leading-tight">
            Automate WhatsApp for <span className="text-primary">Jewelry Shops</span>
          </h1>
          <p className="text-base sm:text-lg text-foreground/60 max-w-2xl mx-auto text-balance">
            Connect with your customers on WhatsApp, automate order confirmations, send product updates, and scale your jewelry business without limits.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="w-full sm:w-auto">
            Schedule Demo
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-foreground/60 pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>24/7 Support</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Powerful Features Built for Jewelry Shops</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Visual Automation',
              description: 'Build workflows without coding',
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: 'Customer CRM',
              description: 'Manage all customer data in one place',
            },
            {
              icon: <MessageSquare className="w-6 h-6" />,
              title: 'Broadcast Campaigns',
              description: 'Send personalized messages instantly',
            },
            {
              icon: <BarChart3 className="w-6 h-6" />,
              title: 'Analytics Dashboard',
              description: 'Track engagement and ROI',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors"
            >
              <div className="text-primary mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-sm sm:text-base mb-2">{feature.title}</h3>
              <p className="text-xs sm:text-sm text-foreground/60">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Connect', description: 'Link your WhatsApp Business account' },
            { step: '2', title: 'Automate', description: 'Create workflows with our visual builder' },
            { step: '3', title: 'Scale', description: 'Reach thousands of customers instantly' },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-base sm:text-lg mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2 text-sm sm:text-base">{item.title}</h3>
              <p className="text-xs sm:text-sm text-foreground/60">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Perfect for Jewelry Shops</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { title: 'Order Confirmation', description: 'Automatically confirm orders and send tracking' },
            { title: 'Customer Support', description: 'Answer questions and resolve issues instantly' },
            { title: 'Product Updates', description: 'Announce new collections to your customers' },
            { title: 'Sales Campaigns', description: 'Run targeted promotions and special offers' },
            { title: 'Appointment Booking', description: 'Let customers book consultations via WhatsApp' },
            { title: 'Payment Reminders', description: 'Send payment reminders and follow-ups' },
          ].map((usecase, index) => (
            <div key={index} className="p-6 rounded-lg border border-border bg-card">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">{usecase.title}</h3>
              <p className="text-xs sm:text-sm text-foreground/60">{usecase.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Grow Your Jewelry Business?</h2>
          <p className="text-sm sm:text-base text-foreground/70 mb-8 max-w-2xl mx-auto">
            Join hundreds of jewelry shop owners who are already using WareChat Pro to automate their WhatsApp communication.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-16 sm:mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs sm:text-sm text-foreground/60">
          <p>&copy; 2024 WareChat Pro. All rights reserved.</p>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

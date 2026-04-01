import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WareChat',
    short_name: 'WareChat',
    description: 'WhatsApp automation, messages, workflows, and customer management for jewelry businesses.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f1e8',
    theme_color: '#111111',
    categories: ['business', 'productivity', 'communication'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    screenshots: [
      {
        src: '/placeholder-logo.png',
        sizes: '1200x630',
        type: 'image/png',
        form_factor: 'wide',
        label: 'WareChat dashboard',
      },
    ],
    shortcuts: [
      {
        name: 'Messages',
        short_name: 'Messages',
        url: '/dashboard/messages',
      },
      {
        name: 'Automation',
        short_name: 'Automation',
        url: '/dashboard/automation',
      },
      {
        name: 'Analytics',
        short_name: 'Analytics',
        url: '/dashboard/analytics',
      },
    ],
  };
}

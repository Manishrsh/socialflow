import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { PwaProvider } from '@/components/pwa-provider'
import './globals.css'

export const metadata: Metadata = {
  applicationName: 'WareChat',
  title: 'WareChat Pro - WhatsApp Automation for Jewelry Shops',
  description: 'Professional WhatsApp automation platform for jewelry businesses. Manage customers, broadcast messages, and automate workflows.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Meta SDK for WhatsApp embedded signup */}
        <script
          async
          defer
          crossOrigin="anonymous"
          src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v20.0"
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <PwaProvider>
          <AuthProvider>
            {children}
            <Analytics />
          </AuthProvider>
        </PwaProvider>
      </body>
    </html>
  )
}

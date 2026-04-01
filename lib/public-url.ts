import { NextRequest } from 'next/server';

export function getPublicOrigin(request: NextRequest): string {
  const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
  const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const envBaseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  return new URL(request.url).origin;
}

export function normalizePublicUrl(url: string | null | undefined, publicOrigin: string): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return `${publicOrigin}${raw}`;
  return raw.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, publicOrigin);
}

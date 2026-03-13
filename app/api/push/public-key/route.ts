import { NextResponse } from 'next/server';
import { getPushPublicKey, isPushConfigured } from '@/lib/push';

export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getPushPublicKey() || null,
  });
}

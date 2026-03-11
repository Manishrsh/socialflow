import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      message: 'WareChat Pro API is running',
    }, { status: 200 });
  } catch (error) {
    console.error('[v0] Health check error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
    }, { status: 500 });
  }
}

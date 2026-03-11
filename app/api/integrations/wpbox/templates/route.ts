import { NextResponse } from 'next/server';
import { getWpboxTemplates } from '@/lib/wpbox-service';

export async function GET() {
  try {
    const templates = await getWpboxTemplates();
    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

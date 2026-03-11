import { NextRequest, NextResponse } from 'next/server';
import { sendWpboxTemplateMessage } from '@/lib/wpbox-service';

export async function POST(request: NextRequest) {
  try {
    const { phone, templateName, templateLanguage, bodyText } =
      await request.json();

    if (!phone || !templateName) {
      return NextResponse.json(
        { success: false, error: 'phone and templateName are required' },
        { status: 400 }
      );
    }

    const result = await sendWpboxTemplateMessage({
      phone,
      templateName,
      templateLanguage,
      bodyText,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send template' },
      { status: 500 }
    );
  }
}

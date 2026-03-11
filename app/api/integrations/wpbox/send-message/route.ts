import { NextRequest, NextResponse } from 'next/server';
import { sendWpboxMessage } from '@/lib/wpbox-service';

export async function POST(request: NextRequest) {
  try {
    const { phone, message, header, footer, buttons } = await request.json();
    const parsedButtons =
      typeof buttons === 'string'
        ? (() => {
            try {
              return JSON.parse(buttons);
            } catch {
              return undefined;
            }
          })()
        : buttons;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'phone and message are required' },
        { status: 400 }
      );
    }

    const result = await sendWpboxMessage({
      phone,
      message,
      header,
      footer,
      buttons: parsedButtons,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { apiUrl, apiKey } = await request.json();

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'API URL and API Key are required' },
        { status: 400 }
      );
    }

    // Test connection to n8n
    try {
      const response = await axios.get(`${apiUrl}/workflows`, {
        headers: {
          'X-N8N-API-KEY': apiKey,
        },
        timeout: 5000,
      });

      console.log('[v0] n8n connection test successful');

      return NextResponse.json({
        connected: true,
        message: 'Successfully connected to n8n',
      });
    } catch (error: any) {
      console.error('[v0] n8n connection test failed:', error.message);

      return NextResponse.json(
        {
          connected: false,
          message: `Failed to connect: ${error.message}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

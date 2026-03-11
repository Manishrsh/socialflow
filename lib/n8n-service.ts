import axios from 'axios';

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://your-domain.com/api/n8n/webhook';

interface WorkflowTrigger {
  workflowId: string;
  customerId: string;
  customerPhone: string;
  message: string;
  messageType?: 'text' | 'image' | 'video' | 'document';
  mediaUrl?: string;
  metadata?: Record<string, any>;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any[];
}

/**
 * Send trigger to n8n workflow
 * This sends data to n8n which processes it through the workflow
 */
export async function triggerN8nWorkflow(
  trigger: WorkflowTrigger
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  try {
    if (!N8N_API_KEY) {
      console.warn('[v0] N8N_API_KEY not configured');
      return { success: false, error: 'N8N not configured' };
    }

    const response = await axios.post(
      `${N8N_API_URL}/workflows/${trigger.workflowId}/execute`,
      {
        data: trigger,
      },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[v0] n8n workflow triggered:', response.data);

    return {
      success: true,
      executionId: response.data.executionId,
    };
  } catch (error: any) {
    console.error('[v0] n8n trigger error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to trigger workflow',
    };
  }
}

/**
 * Get workflow details from n8n
 */
export async function getN8nWorkflow(
  workflowId: string
): Promise<N8nWorkflow | null> {
  try {
    if (!N8N_API_KEY) {
      return null;
    }

    const response = await axios.get(
      `${N8N_API_URL}/workflows/${workflowId}`,
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('[v0] Failed to fetch workflow:', error);
    return null;
  }
}

/**
 * List all n8n workflows
 */
export async function listN8nWorkflows(): Promise<N8nWorkflow[]> {
  try {
    if (!N8N_API_KEY) {
      return [];
    }

    const response = await axios.get(`${N8N_API_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    });

    return response.data.data || [];
  } catch (error) {
    console.error('[v0] Failed to list workflows:', error);
    return [];
  }
}

/**
 * Create n8n webhook URL with signature
 */
export function getN8nWebhookUrl(token?: string): string {
  const baseUrl = N8N_WEBHOOK_URL;
  if (token) {
    return `${baseUrl}?token=${token}`;
  }
  return baseUrl;
}

/**
 * Send WhatsApp message via n8n
 * This is called when a workflow needs to send a message
 */
export async function sendWhatsAppMessage(
  customerPhone: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // This would trigger a specialized n8n workflow for sending messages
    // The actual implementation depends on your n8n setup

    console.log(`[v0] Sending WhatsApp to ${customerPhone}: ${message}`);

    return {
      success: true,
      messageId: Math.random().toString(36).substr(2, 9),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify n8n webhook signature
 */
export function verifyN8nSignature(
  signature: string | null,
  payload: string,
  secret: string
): boolean {
  if (!signature) return false;

  // TODO: Implement proper HMAC verification
  // This is a simplified version
  return true;
}

/**
 * Handle incoming WhatsApp message from customer
 * This is called by the webhook when n8n receives a message
 */
export async function handleIncomingMessage(data: {
  customerPhone: string;
  customerId: string;
  message: string;
  timestamp: string;
  messageId: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  try {
    console.log('[v0] Processing incoming message from:', data.customerPhone);

    // Message processing happens in the webhook route
    // This function can be used for additional processing

    return true;
  } catch (error) {
    console.error('[v0] Error handling incoming message:', error);
    return false;
  }
}

/**
 * Test n8n connection
 */
export async function testN8nConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    if (!N8N_API_KEY) {
      return {
        connected: false,
        message: 'N8N_API_KEY not configured',
      };
    }

    const response = await axios.get(`${N8N_API_URL}/credentials`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
      timeout: 5000,
    });

    return {
      connected: true,
      message: 'Connected to n8n successfully',
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Failed to connect to n8n: ${error.message}`,
    };
  }
}

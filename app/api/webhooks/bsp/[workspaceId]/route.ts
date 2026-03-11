import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { mapInboundEvent } from '@/lib/bsp-webhook-mappers';

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

const SHARED_WEBHOOK_TOKEN = process.env.BSP_WEBHOOK_TOKEN || '';
const DEFAULT_PROVIDER = (process.env.BSP_DEFAULT_PROVIDER || 'generic').toLowerCase();
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
const INTERNAL_EXECUTION_TOKEN = process.env.INTERNAL_EXECUTION_TOKEN || '';

function getTokenFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-webhook-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    new URL(request.url).searchParams.get('token') ||
    ''
  );
}

function getProviderFromRequest(request: NextRequest): string {
  const url = new URL(request.url);
  return (
    request.headers.get('x-bsp-provider') ||
    url.searchParams.get('provider') ||
    DEFAULT_PROVIDER
  ).toLowerCase();
}

async function parseWebhookBody(request: NextRequest): Promise<any> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    const obj: Record<string, any> = {};
    for (const [key, val] of formData.entries()) {
      obj[key] = typeof val === 'string' ? val : String(val);
    }
    return obj;
  }

  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const hubMode = url.searchParams.get('hub.mode');
  const hubChallenge = url.searchParams.get('hub.challenge');
  const hubVerifyToken = url.searchParams.get('hub.verify_token');

  if (hubMode === 'subscribe' && hubChallenge) {
    if (META_WEBHOOK_VERIFY_TOKEN && hubVerifyToken === META_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(hubChallenge, { status: 200 });
    }
    return new NextResponse('Invalid verify token', { status: 403 });
  }

  return NextResponse.json({
    status: 'ok',
    workspaceId,
    message: 'BSP webhook endpoint ready',
    usage: {
      method: 'POST',
      provider: 'set via x-bsp-provider header or ?provider= (optional)',
      defaultProvider: DEFAULT_PROVIDER,
      auth: 'x-webhook-token header or ?token=',
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureCoreSchema();
    const { workspaceId } = await params;
    const provider = getProviderFromRequest(request);

    const requestToken = getTokenFromRequest(request);
    const requiresSharedToken = provider !== 'meta';
    if (requiresSharedToken && (!SHARED_WEBHOOK_TOKEN || requestToken !== SHARED_WEBHOOK_TOKEN)) {
      return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 });
    }

    const workspaces = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} LIMIT 1
    `;
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await parseWebhookBody(request);
    const normalized = mapInboundEvent(provider, body);

    if (normalized.externalMessageId) {
      const dedupRows = await sql`
        INSERT INTO inbound_event_dedup (id, workspace_id, provider, external_message_id, event_type)
        VALUES (
          ${uuidv4()},
          ${workspaceId},
          ${normalized.provider},
          ${String(normalized.externalMessageId)},
          ${String(normalized.eventType || 'message')}
        )
        ON CONFLICT (workspace_id, provider, external_message_id, event_type)
        DO NOTHING
        RETURNING id
      `;

      if (!dedupRows || dedupRows.length === 0) {
        await sql`
          INSERT INTO workflow_execution_logs (
            id, workspace_id, workflow_id, phone, trigger_source, status, executed_nodes, summary, details
          )
          SELECT
            ${uuidv4()},
            ${workspaceId},
            w.id,
            ${String(normalized.phone || '')},
            ${'webhook'},
            ${'ignored_duplicate'},
            ${0},
            ${'Duplicate webhook ignored'},
            ${JSON.stringify({
              provider: normalized.provider,
              externalMessageId: normalized.externalMessageId,
              eventType: normalized.eventType,
            })}
          FROM workflows w
          WHERE w.workspace_id = ${workspaceId} AND w.is_active = true
        `;

        return NextResponse.json({
          success: true,
          duplicate: true,
          provider: normalized.provider,
          externalMessageId: normalized.externalMessageId,
        });
      }
    }

    const eventId = uuidv4();
    await sql`
      INSERT INTO webhook_events (id, workspace_id, provider, event_type, payload)
      VALUES (
        ${eventId},
        ${workspaceId},
        ${normalized.provider},
        ${normalized.eventType},
        ${JSON.stringify(body)}
      )
    `;

    let customerId: string | null = null;
    let messageId: string | null = null;

    if (normalized.phone) {
      const customerRows = await sql`
        INSERT INTO customers (id, workspace_id, phone, metadata)
        VALUES (
          ${uuidv4()},
          ${workspaceId},
          ${String(normalized.phone)},
          ${JSON.stringify({
            provider: normalized.provider,
            externalMessageId: normalized.externalMessageId || null,
          })}
        )
        ON CONFLICT (workspace_id, phone)
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      customerId = customerRows?.[0]?.id || null;
    }

    if (customerId && (normalized.message || normalized.mediaUrl)) {
      messageId = uuidv4();
      await sql`
        INSERT INTO messages (id, workspace_id, customer_id, direction, type, content, media_url)
        VALUES (
          ${messageId},
          ${workspaceId},
          ${customerId},
          ${'inbound'},
          ${normalized.mediaUrl ? 'media' : 'text'},
          ${normalized.message || null},
          ${normalized.mediaUrl || null}
        )
      `;
    }

    // Background automation trigger for active workflows with triggerMessage node.
    try {
      if (INTERNAL_EXECUTION_TOKEN) {
        const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const normalizedEventType = String(normalized.eventType || '').trim().toLowerCase();
        const buttonReplyId =
          (normalized.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.id) ||
          (normalized.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.list_reply?.id) ||
          (normalized.raw?.button_reply?.id) ||
          (normalized.raw?.list_reply?.id) ||
          '';
        const buttonReplyTitle =
          (normalized.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.title) ||
          (normalized.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.list_reply?.title) ||
          (normalized.raw?.button_reply?.title) ||
          (normalized.raw?.list_reply?.title) ||
          '';
        const hasReplySignal = !!String(buttonReplyId || '').trim() || !!String(buttonReplyTitle || '').trim();
        const hasInboundMessageSignal =
          !!String(normalized.message || '').trim() ||
          !!String(normalized.mediaUrl || '').trim() ||
          hasReplySignal;
        const isStatusOnlyEvent = ['sent', 'delivered', 'read', 'failed'].includes(normalizedEventType);

        if (!hasInboundMessageSignal || isStatusOnlyEvent) {
          return NextResponse.json({
            success: true,
            eventId,
            customerId,
            messageId,
            provider: normalized.provider,
            normalized,
            ignored: 'status_or_empty_event',
          });
        }

        if (hasReplySignal && normalized.phone) {
          const waits = await sql`
            SELECT id, workflow_id, node_id
            FROM workflow_wait_states
            WHERE workspace_id = ${workspaceId}
              AND phone = ${String(normalized.phone)}
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC
            LIMIT 1
          `;

          const wait = waits?.[0];
          if (wait?.workflow_id) {
            const resumePayload = {
              phone: String(normalized.phone),
              variables: {
                message: normalized.message || '',
                mediaUrl: normalized.mediaUrl || '',
                buttonReplyId: String(buttonReplyId || ''),
                buttonReplyTitle: String(buttonReplyTitle || ''),
                resumeNodeId: String(wait.node_id || ''),
              },
            };

            await fetch(`${baseUrl}/api/workflows/${wait.workflow_id}/execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-execution-token': INTERNAL_EXECUTION_TOKEN,
              },
              body: JSON.stringify(resumePayload),
            });

            await sql`DELETE FROM workflow_wait_states WHERE id = ${wait.id}`;
            return NextResponse.json({
              success: true,
              eventId,
              customerId,
              messageId,
              provider: normalized.provider,
              normalized,
              resumedWorkflowId: wait.workflow_id,
            });
          }
        }

        const activeWorkflows = await sql`
          SELECT id, nodes
          FROM workflows
          WHERE workspace_id = ${workspaceId} AND is_active = true
          ORDER BY updated_at DESC
          LIMIT 25
        `;

        const hasTrigger = (nodesValue: any) => {
          if (!nodesValue) return false;
          const nodesArr = typeof nodesValue === 'string' ? JSON.parse(nodesValue || '[]') : nodesValue;
          return Array.isArray(nodesArr) && nodesArr.some((n: any) => String(n?.type || '') === 'triggerMessage');
        };

        const candidates = (activeWorkflows || []).filter((wf: any) => {
          try {
            return hasTrigger(wf.nodes);
          } catch {
            return false;
          }
        });

        const workflowRuns = candidates
          .filter(() => !!normalized.phone)
          .map((wf: any) => {
            const payload = {
              phone: String(normalized.phone || ''),
              variables: {
                message: normalized.message || '',
                mediaUrl: normalized.mediaUrl || '',
                buttonReplyId: String(buttonReplyId || ''),
                buttonReplyTitle: String(buttonReplyTitle || ''),
              },
            };

            return fetch(`${baseUrl}/api/workflows/${wf.id}/execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-execution-token': INTERNAL_EXECUTION_TOKEN,
              },
              body: JSON.stringify(payload),
            });
          });

        await Promise.allSettled(workflowRuns);
      }
    } catch {
      // Non-blocking background trigger.
    }

    return NextResponse.json({
      success: true,
      eventId,
      customerId,
      messageId,
      provider: normalized.provider,
      normalized,
    });
  } catch (error: any) {
    console.error('BSP webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

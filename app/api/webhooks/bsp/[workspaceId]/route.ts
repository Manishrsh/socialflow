import { pusherServer } from '@/lib/pusher';
import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCoreSchema } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { mapInboundEvent } from '@/lib/bsp-webhook-mappers';
import { isPushConfigured, sendPushToWorkspace } from '@/lib/push';
import { getPublicOrigin, normalizePublicUrl } from '@/lib/public-url';
import { analyzeMessage, updateMessageWithAnalysis, updateKeywordFrequency, detectCustomerSegment } from '@/lib/nlp-engine';

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

const SHARED_WEBHOOK_TOKEN = process.env.BSP_WEBHOOK_TOKEN || '';
const DEFAULT_PROVIDER = (process.env.BSP_DEFAULT_PROVIDER || 'generic').toLowerCase();
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
const INTERNAL_EXECUTION_TOKEN = process.env.INTERNAL_EXECUTION_TOKEN || '';

function normalizeTextValue(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function pickBookingValue(data: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeTextValue(data?.[key]);
    if (value) return value;
  }
  return null;
}

async function saveAppointmentBooking(input: {
  workspaceId: string;
  customerId: string | null;
  phone: string;
  flowId?: string | null;
  flowToken?: string | null;
  flowReply: Record<string, any>;
}): Promise<string | null> {
  const bookingDate = pickBookingValue(input.flowReply, [
    'appointment_date',
    'date',
    'booking_date',
    'preferred_date',
  ]);
  const bookingTime = pickBookingValue(input.flowReply, [
    'appointment_time',
    'time',
    'booking_time',
    'preferred_time',
    'time_slot',
  ]);
  const service = pickBookingValue(input.flowReply, [
    'service',
    'appointment_type',
    'service_type',
    'reason',
  ]);
  const assignee = pickBookingValue(input.flowReply, [
    'staff',
    'advisor',
    'representative',
    'assignee',
  ]);
  const notes = pickBookingValue(input.flowReply, ['notes', 'note', 'comment', 'comments']);

  const bookingRows = await sql`
    INSERT INTO appointment_bookings (
      id,
      workspace_id,
      customer_id,
      phone,
      flow_token,
      flow_id,
      booking_date,
      booking_time,
      service,
      assignee,
      notes,
      details
    )
    VALUES (
      ${uuidv4()},
      ${input.workspaceId},
      ${input.customerId},
      ${input.phone},
      ${input.flowToken || null},
      ${input.flowId || null},
      ${bookingDate},
      ${bookingTime},
      ${service},
      ${assignee},
      ${notes},
      ${JSON.stringify(input.flowReply || {})}
    )
    RETURNING id
  `;

  return bookingRows?.[0]?.id ? String(bookingRows[0].id) : null;
}

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

function inferProviderFromBody(provider: string, body: any): string {
  const messagingProduct =
    String(body?.entry?.[0]?.changes?.[0]?.value?.messaging_product || body?.messaging_product || '').trim().toLowerCase();

  if (messagingProduct === 'instagram') {
    return 'instagram';
  }

  if (messagingProduct === 'whatsapp_business_account' || messagingProduct === 'whatsapp') {
    return 'meta';
  }

  return provider;
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

  console.log('[Webhook BSP][GET] Verification request', {
    workspaceId,
    hubMode,
    hasChallenge: !!hubChallenge,
    provider: url.searchParams.get('provider') || null,
  });

  if (hubMode === 'subscribe' && hubChallenge) {
    if (META_WEBHOOK_VERIFY_TOKEN && hubVerifyToken === META_WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook BSP][GET] Verification successful', { workspaceId });
      return new NextResponse(hubChallenge, { status: 200 });
    }
    console.error('[Webhook BSP][GET] Verification failed', {
      workspaceId,
      hasConfiguredToken: !!META_WEBHOOK_VERIFY_TOKEN,
      tokenMatched: !!META_WEBHOOK_VERIFY_TOKEN && hubVerifyToken === META_WEBHOOK_VERIFY_TOKEN,
    });
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
    const publicOrigin = getPublicOrigin(request);
    console.log('[Webhook BSP][POST] Incoming request', {
      workspaceId,
      provider,
      url: request.nextUrl.toString(),
      contentType: request.headers.get('content-type'),
      hasAuthHeader: !!request.headers.get('authorization'),
      hasWebhookToken: !!request.headers.get('x-webhook-token'),
    });

    const requestToken = getTokenFromRequest(request);
    // const requiresSharedToken = provider !== 'meta' && provider !== 'instagram';
    // if (requiresSharedToken && (!SHARED_WEBHOOK_TOKEN || requestToken !== SHARED_WEBHOOK_TOKEN)) {
    //   console.error('[Webhook BSP][POST] Unauthorized webhook token', {
    //     workspaceId,
    //     provider,
    //     requiresSharedToken,
    //     hasSharedTokenConfigured: !!SHARED_WEBHOOK_TOKEN,
    //     hasRequestToken: !!requestToken,
    //   });
    //   return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 });
    // }

    const workspaces = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} LIMIT 1
    `;
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await parseWebhookBody(request);
    console.log('[Webhook BSP][POST] Parsed webhook body', {
      workspaceId,
      provider,
      object: body?.object || null,
      messagingProduct:
        body?.entry?.[0]?.changes?.[0]?.value?.messaging_product || body?.messaging_product || null,
      eventKeys: Object.keys(body || {}),
    });
    const inferredProvider = inferProviderFromBody(provider, body);
    const normalized = mapInboundEvent(inferredProvider, body);
    console.log('[Webhook BSP][POST] Normalized inbound event', {
      workspaceId,
      provider,
      inferredProvider,
      normalizedProvider: normalized.provider,
      eventType: normalized.eventType,
      phone: normalized.phone || null,
      externalMessageId: normalized.externalMessageId || null,
      hasMessage: !!normalized.message,
      hasMediaUrl: !!normalized.mediaUrl,
      hasButtonReply: !!normalized.buttonReplyId || !!normalized.buttonReplyTitle,
      hasFlowReply: !!normalized.flowReply,
    });

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
        console.warn('[Webhook BSP][POST] Duplicate webhook ignored', {
          workspaceId,
          provider: normalized.provider,
          externalMessageId: normalized.externalMessageId,
          eventType: normalized.eventType,
        });
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
    console.log('[Webhook BSP][POST] Inserting webhook event', {
      eventId,
      workspaceId,
      provider: normalized.provider,
      eventType: normalized.eventType,
    });
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
    let appointmentBookingId: string | null = null;

    if (normalized.phone) {
      console.log('[Webhook BSP][POST] Upserting customer', {
        workspaceId,
        phone: String(normalized.phone),
        provider: normalized.provider,
      });
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

    if (customerId && normalized.phone && normalized.flowReply) {
      console.log('[Webhook BSP][POST] Saving appointment booking', {
        workspaceId,
        customerId,
        phone: String(normalized.phone),
        flowId: normalizeTextValue(normalized.flowReply?.flow_id),
      });
      appointmentBookingId = await saveAppointmentBooking({
        workspaceId,
        customerId,
        phone: String(normalized.phone),
        flowId: normalizeTextValue(normalized.flowReply?.flow_id),
        flowToken: normalized.flowToken || normalizeTextValue(normalized.flowReply?.flow_token),
        flowReply: normalized.flowReply,
      });
    }

    if (customerId && (normalized.message || normalized.mediaUrl || normalized.flowReply)) {
      messageId = uuidv4();

      const normalizedEventType = String(normalized.eventType || '').trim().toLowerCase();
      const messageType = normalized.flowReply
        ? 'flow_response'
        : normalized.mediaUrl
          ? (['image', 'video', 'audio', 'document', 'sticker'].includes(normalizedEventType)
            ? normalizedEventType
            : 'media')
          : 'text';
      const content = normalized.message || (normalized.flowReply ? 'Submitted WhatsApp form' : null);
      const mediaUrl = normalizePublicUrl(normalized.mediaUrl || null, publicOrigin);
      const sentAt = new Date().toISOString();

      await sql`
        INSERT INTO messages (id, workspace_id, customer_id, direction, type, content, media_url, sent_at)
        VALUES (
          ${messageId},
          ${workspaceId},
          ${customerId},
          ${'inbound'},
          ${messageType},
          ${content},
          ${mediaUrl},
          ${sentAt}
        )
      `;
      console.log('[Webhook BSP][POST] Stored inbound message', {
        workspaceId,
        customerId,
        messageId,
        phone: String(normalized.phone),
        messageType,
        hasContent: !!content,
        hasMediaUrl: !!mediaUrl,
      });

      // Track the customer's last inbound message time so delayed auto-messages can fire correctly
      if (customerId) {
        await sql`
          UPDATE customers
          SET last_user_message_at = ${sentAt}
          WHERE id = ${customerId}
        `;
      }

      // Process message with NLP engine in background
      if (content) {
        try {
          console.log('[Webhook BSP][POST] Running NLP analysis', {
            workspaceId,
            customerId,
            messageId,
            hasImage: !!mediaUrl && ['image', 'video', 'document'].includes(messageType),
          });
          const hasImage = !!mediaUrl && ['image', 'video', 'document'].includes(messageType);
          const analysis = await analyzeMessage(content, hasImage);
          await updateMessageWithAnalysis(messageId, analysis);

          // Update keyword frequency tracking
          await updateKeywordFrequency(workspaceId, analysis.keywords, analysis.sentiment);

          // Detect and update customer segment asynchronously
          setTimeout(async () => {
            try {
              const segment = await detectCustomerSegment(workspaceId, customerId);
              await sql`
                UPDATE customers
                SET customer_segment = ${segment}
                WHERE id = ${customerId}
              `;
            } catch (err) {
              console.error('[NLP] Error detecting customer segment:', err);
            }
          }, 0);
        } catch (err) {
          console.error('[NLP] Error analyzing message:', err);
        }
      }

      // Trigger auto-messages for new customers
      if (customerId) {
        try {
          console.log('[Webhook BSP][POST] Checking auto-message rules', {
            workspaceId,
            customerId,
            phone: String(normalized.phone),
          });
          // Check if this is a new customer (first message)
          const messageCount = await sql`
            SELECT COUNT(*)::int AS count FROM messages 
            WHERE customer_id = ${customerId}
          `;

          const autoRules = await sql`
            SELECT * FROM auto_message_rules 
            WHERE workspace_id = ${workspaceId} 
              AND enabled = true
              AND (
                rule_type = 'all_customers'
                OR (rule_type = 'new_users' AND ${messageCount?.[0]?.count} = 1)
              )
          `;

          for (const rule of autoRules || []) {
            // Only schedule a new_users rule for the first customer message
            if (rule.rule_type === 'new_users' && messageCount?.[0]?.count !== 1) {
              continue;
            }

            const delayMs = ((rule.delay_hours || 0) * 60 * 60 * 1000) + ((rule.delay_minutes || 0) * 60 * 1000);
            const scheduledAt = new Date(Date.now() + delayMs);

            await sql`
              INSERT INTO scheduled_messages (
                id, workspace_id, customer_id, phone, message, scheduled_at, status, schedule_mode, created_at
              ) VALUES (
                ${uuidv4()},
                ${workspaceId},
                ${customerId},
                ${String(normalized.phone)},
                ${rule.message_template},
                ${scheduledAt.toISOString()},
                'pending',
                'fixed',
                CURRENT_TIMESTAMP
              )
            `;
            console.log('[Webhook BSP][POST] Scheduled auto-message rule', {
              workspaceId,
              customerId,
              phone: String(normalized.phone),
              ruleId: rule.id || null,
              ruleType: rule.rule_type,
              delayMs,
              scheduledAt: scheduledAt.toISOString(),
            });
          }
        } catch (err) {
          console.error('[v0] Auto-message trigger error:', err);
        }
      }

      const unreadRows = await sql`
        SELECT COUNT(*)::int AS total
        FROM messages
        WHERE workspace_id = ${workspaceId}
          AND direction = 'inbound'
          AND read_at IS NULL
      `;
      const unreadCount = Number(unreadRows?.[0]?.total || 0);

      try {
        await pusherServer.trigger(`workspace-${workspaceId}`, 'new-message', {
          id: messageId,
          customerId,
          phone: String(normalized.phone || ''),
          name: null,
          source: normalized.provider,
          content: content || '',
          mediaUrl,
          direction: 'inbound',
          type: messageType,
          sentAt,
          readAt: null,
          unreadCount,
        });
        console.log('[Webhook BSP][POST] Pusher inbound event sent', {
          workspaceId,
          customerId,
          messageId,
          provider: normalized.provider,
          unreadCount,
        });
      } catch (err) {
        console.error('Failed to trigger Pusher event for inbound webhook:', err);
      }

      try {
        if (isPushConfigured()) {
          const notificationBody = normalized.flowReply
            ? 'New appointment form submitted'
            : normalized.message
              ? String(normalized.message).slice(0, 140)
              : normalized.mediaUrl
                ? 'New media message'
                : 'You received a new message';

          await sendPushToWorkspace(workspaceId, {
            title: normalized.phone ? `New message from ${normalized.phone}` : 'New message',
            body: notificationBody,
            tag: `workspace-${workspaceId}-messages`,
            url: '/dashboard/messages',
            icon: '/icon-light-32x32.png',
            badge: '/icon-light-32x32.png',
            unreadCount,
          });
          console.log('[Webhook BSP][POST] Push notification sent', {
            workspaceId,
            customerId,
            phone: String(normalized.phone || ''),
            unreadCount,
          });
        }
      } catch {
        // Do not block webhook processing on push delivery.
      }
    }

    try {
      if (INTERNAL_EXECUTION_TOKEN) {
        console.log('[Webhook BSP][POST] Internal workflow trigger enabled', {
          workspaceId,
          provider: normalized.provider,
          hasMessage: !!normalized.message,
          hasMediaUrl: !!normalized.mediaUrl,
          hasFlowReply: !!normalized.flowReply,
          hasButtonReply: !!normalized.buttonReplyId || !!normalized.buttonReplyTitle,
        });
        const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const normalizedEventType = String(normalized.eventType || '').trim().toLowerCase();
        const buttonReplyId = String(normalized.buttonReplyId || '').trim();
        const buttonReplyTitle = String(normalized.buttonReplyTitle || '').trim();
        const hasTextMessage = !!String(normalized.message || '').trim();
        const hasReplySignal = !!buttonReplyId || !!buttonReplyTitle;
        const hasFlowReplySignal = !!normalized.flowReply;
        const hasInboundMessageSignal =
          hasTextMessage ||
          !!String(normalized.mediaUrl || '').trim() ||
          hasReplySignal ||
          hasFlowReplySignal;
        const isStatusOnlyEvent = ['sent', 'delivered', 'read', 'failed'].includes(normalizedEventType);

        if (!hasInboundMessageSignal || isStatusOnlyEvent) {
          console.log('[Webhook BSP][POST] Ignoring non-inbound event', {
            workspaceId,
            provider: normalized.provider,
            eventType: normalized.eventType,
            hasInboundMessageSignal,
            isStatusOnlyEvent,
            reason: !hasInboundMessageSignal
              ? 'missing_inbound_message_signal'
              : 'status_event',
          });
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

        if ((hasReplySignal || hasFlowReplySignal || hasTextMessage) && normalized.phone) {
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
            console.log('[Webhook BSP][POST] Resuming waiting workflow', {
              workspaceId,
              workflowId: wait.workflow_id,
              nodeId: wait.node_id,
              phone: String(normalized.phone),
              provider: normalized.provider,
            });
            const resumePayload = {
              phone: String(normalized.phone),
              variables: {
                message: normalized.message || '',
                mediaUrl: normalized.mediaUrl || '',
                buttonReplyId,
                buttonReplyTitle,
                flowToken: String(normalized.flowToken || ''),
                flowResponse: normalized.flowReply || null,
                appointmentBookingId: appointmentBookingId || null,
                resumeNodeId: String(wait.node_id || ''),
                channel: normalized.provider === 'instagram' ? 'instagram' : 'whatsapp',
              },
            };

            const resumeResponse = await fetch(`${baseUrl}/api/workflows/${wait.workflow_id}/execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-execution-token': INTERNAL_EXECUTION_TOKEN,
              },
              body: JSON.stringify(resumePayload),
            });
            console.log('[Webhook BSP][POST] Resume execution response', {
              workspaceId,
              workflowId: wait.workflow_id,
              status: resumeResponse.status,
              ok: resumeResponse.ok,
            });

            await sql`DELETE FROM workflow_wait_states WHERE id = ${wait.id}`;
            return NextResponse.json({
              success: true,
              eventId,
              customerId,
              messageId,
              appointmentBookingId,
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

        const hasInboundTrigger = (nodesValue: any) => {
          if (!nodesValue) return false;
          const nodesArr = typeof nodesValue === 'string' ? JSON.parse(nodesValue || '[]') : nodesValue;
          return (
            Array.isArray(nodesArr) &&
            nodesArr.some((n: any) => {
              const type = String(n?.type || '').trim();
              return type === 'triggerMessage' || type === 'triggerKeyword';
            })
          );
        };

        const candidates = (activeWorkflows || []).filter((wf: any) => {
          try {
            return hasInboundTrigger(wf.nodes);
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
                buttonReplyId,
                buttonReplyTitle,
                flowToken: String(normalized.flowToken || ''),
                flowResponse: normalized.flowReply || null,
                appointmentBookingId: appointmentBookingId || null,
                channel: normalized.provider === 'instagram' ? 'instagram' : 'whatsapp',
              },
            };

            console.log('[Webhook BSP][POST] Triggering workflow execution', {
              workspaceId,
              workflowId: wf.id,
              phone: String(normalized.phone || ''),
              provider: normalized.provider,
              channel: normalized.provider === 'instagram' ? 'instagram' : 'whatsapp',
              nodeCount: Array.isArray(wf.nodes) ? wf.nodes.length : undefined,
            });
            return fetch(`${baseUrl}/api/workflows/${wf.id}/execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-execution-token': INTERNAL_EXECUTION_TOKEN,
              },
              body: JSON.stringify(payload),
            }).then(async (response) => {
              let responseText = '';
              try {
                responseText = await response.text();
              } catch {
                responseText = '';
              }
              console.log('[Webhook BSP][POST] Workflow execution response', {
                workspaceId,
                workflowId: wf.id,
                status: response.status,
                ok: response.ok,
                responseText: responseText.slice(0, 500),
              });
              return response;
            });
          });

        const runResults = await Promise.allSettled(workflowRuns);
        console.log('[Webhook BSP][POST] Workflow fan-out completed', {
          workspaceId,
          total: runResults.length,
          fulfilled: runResults.filter((result) => result.status === 'fulfilled').length,
          rejected: runResults.filter((result) => result.status === 'rejected').length,
        });
      } else {
        console.warn('[Webhook BSP][POST] Workflow execution skipped because INTERNAL_EXECUTION_TOKEN is missing', {
          workspaceId,
          provider: normalized.provider,
        });
      }
    } catch {
      // Non-blocking background trigger.
    }

    return NextResponse.json({
      success: true,
      eventId,
      customerId,
      messageId,
      appointmentBookingId,
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

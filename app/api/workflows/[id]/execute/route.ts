import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCoreSchema, sql } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { randomUUID } from 'crypto';
import {
  queueOwnBspMediaMessage,
  queueOwnBspMessage,
  queueOwnBspTemplateMessage,
  upsertOwnBspContact,
} from '@/lib/own-bsp-service';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface FlowNode {
  id: string;
  type?: string;
  data?: Record<string, any>;
}

interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

const BACK_TO_MAIN_MENU_NODE_TYPE = 'systemBackToMainMenu';

function getMainMenuTargetNodeId(node: FlowNode, nodeById: Map<string, FlowNode>): string | null {
  const targetNodeId = String(node.data?.mainMenuNodeId || '').trim();
  if (!targetNodeId) return null;
  if (targetNodeId === node.id) return null;
  return nodeById.has(targetNodeId) ? targetNodeId : null;
}

function normalizeNodeButtons(data: Record<string, any>): Array<{ id: string; title: string }> {
  const arrayButtons = Array.isArray(data.buttons) ? data.buttons : [];
  if (arrayButtons.length > 0) {
    return arrayButtons
      .map((b: any, idx: number) => ({
        id: String(b?.id || idx + 1).trim(),
        title: String(b?.title || `Option ${idx + 1}`).trim(),
      }))
      .filter((b) => b.id && b.title);
  }

  const manualButtons = [
    data.button1Title
      ? { id: String(data.button1Id || '1'), title: String(data.button1Title) }
      : null,
    data.button2Title
      ? { id: String(data.button2Id || '2'), title: String(data.button2Title) }
      : null,
  ].filter(Boolean) as Array<{ id: string; title: string }>;
  return manualButtons
    .map((b: any, idx: number) => ({
      id: String(b?.id || idx + 1).trim(),
      title: String(b?.title || `Option ${idx + 1}`).trim(),
    }))
    .filter((b) => b.id && b.title);
}

function normalizeMediaItems(
  data: Record<string, any>,
  variables: Record<string, any> | undefined
): Array<{ mediaUrl: string; mediaType: string; caption: string; metaMediaId: string }> {
  const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
  const normalizedItems = mediaItems
    .map((item: any) => ({
      mediaUrl: String(item?.mediaUrl || '').trim(),
      mediaType: String(item?.mediaType || data.mediaType || 'image').trim().toLowerCase(),
      caption: String(item?.caption || '').trim(),
      metaMediaId: String(item?.metaMediaId || '').trim(),
    }))
    .filter((item) => item.mediaUrl || item.metaMediaId);

  if (normalizedItems.length > 0) {
    return normalizedItems;
  }

  const legacyMediaUrl = String(data.mediaUrl || data.url || '').trim();
  const legacyMetaMediaId = String(data.metaMediaId || '').trim();
  if (!legacyMediaUrl && !legacyMetaMediaId) return [];

  return [
    {
      mediaUrl: legacyMediaUrl,
      mediaType: String(data.mediaType || 'image').trim().toLowerCase(),
      caption: String(data.caption || data.message || variables?.message || 'Media message').trim(),
      metaMediaId: legacyMetaMediaId,
    },
  ];
}

function replyMatchesInteractiveNode(
  node: FlowNode,
  variables: Record<string, any> | undefined
): boolean {
  const replyId = String(variables?.buttonReplyId || variables?.buttonId || '').trim();
  const replyTitle = String(variables?.buttonReplyTitle || variables?.buttonTitle || '').trim().toLowerCase();
  if (!replyId && !replyTitle) return false;

  const buttons = normalizeNodeButtons(node.data || {});
  if (replyId && buttons.some((button) => String(button.id || '').trim() === replyId)) {
    return true;
  }
  if (replyTitle && buttons.some((button) => String(button.title || '').trim().toLowerCase() === replyTitle)) {
    return true;
  }
  return false;
}

function resolvePublicBaseUrl(request: NextRequest): string {
  const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
  const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const envBaseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');

  return request.nextUrl.origin;
}

function normalizeOutboundMediaUrl(mediaUrl: string, publicBaseUrl: string): string {
  const raw = String(mediaUrl || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/')) return `${publicBaseUrl}${raw}`;
  return raw.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, publicBaseUrl);
}

function toArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeKeywords(data: Record<string, any> | undefined): string[] {
  const keywordList = Array.isArray(data?.keywords) ? data?.keywords : [];
  const normalizedList = keywordList
    .map((item: any) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  if (normalizedList.length > 0) return normalizedList;

  const singleKeyword = String(data?.keyword || '').trim().toLowerCase();
  return singleKeyword ? [singleKeyword] : [];
}

function getIncomingText(variables: Record<string, any> | undefined): string {
  return String(
    variables?.message ||
    variables?.buttonReplyTitle ||
    variables?.buttonTitle ||
    ''
  )
    .trim()
    .toLowerCase();
}

function conditionNodeMatches(node: FlowNode, variables: Record<string, any> | undefined): boolean {
  const rawCondition = String(node.data?.condition || '').trim();
  if (!rawCondition) return false;

  const incomingText = getIncomingText(variables);
  if (!incomingText) return false;

  const normalizedCondition = rawCondition.toLowerCase();
  const containsMatch = normalizedCondition.match(/^message\.contains\((['"])(.*?)\1\)$/i);
  if (containsMatch) {
    const needle = String(containsMatch[2] || '').trim().toLowerCase();
    return needle ? incomingText.includes(needle) : false;
  }

  const equalsMatch = normalizedCondition.match(/^message\s*==\s*(['"])(.*?)\1$/i);
  if (equalsMatch) {
    return incomingText === String(equalsMatch[2] || '').trim().toLowerCase();
  }

  return incomingText.includes(normalizedCondition);
}

function keywordNodeMatches(node: FlowNode, variables: Record<string, any> | undefined): boolean {
  const keywords = normalizeKeywords(node.data || {});
  if (keywords.length === 0) return false;
  const incomingText = getIncomingText(variables);
  if (!incomingText) return false;
  return keywords.some((keyword) => incomingText.includes(keyword));
}

function findMatchingStartNode(
  starters: FlowNode[],
  variables: Record<string, any> | undefined
): FlowNode | null {
  const keywordStarters = starters.filter((node) => node.type === 'triggerKeyword');

  if (keywordStarters.length > 0) {
    for (const node of keywordStarters) {
      if (keywordNodeMatches(node, variables)) {
        return node;
      }
    }

    return null;
  }

  for (const node of starters) {
    if (node.type === 'triggerMessage') {
      return node;
    }
  }

  return starters[0] || null;
}

function resolveExecutionOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incomingCount.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  }

  const starters = nodes.filter(
    (n) => (n.type || '').startsWith('trigger') || (incomingCount.get(n.id) || 0) === 0
  );
  const queue = starters.map((n) => n.id);
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) continue;
    ordered.push(node);

    for (const nextId of outgoing.get(nodeId) || []) {
      if (!visited.has(nextId)) queue.push(nextId);
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) ordered.push(node);
  }

  return ordered;
}

function resolveExecutionPath(
  nodes: FlowNode[],
  edges: FlowEdge[],
  variables: Record<string, any> | undefined
): FlowNode[] {
  if (!nodes.length) return [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incomingCount.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  }

  const starters = nodes.filter(
    (n) => (n.type || '').startsWith('trigger') || (incomingCount.get(n.id) || 0) === 0
  );
  const resumeNodeId = String(variables?.resumeNodeId || '').trim();
  let currentReplyId = String(variables?.buttonReplyId || variables?.buttonId || '').trim();
  let currentReplyTitle = String(variables?.buttonReplyTitle || variables?.buttonTitle || '').trim();
  const hasReply = !!currentReplyId || !!currentReplyTitle;

  const matchedStartNode = findMatchingStartNode(starters, variables);
  const fallbackStartNode = starters.length === 0 ? nodes[0] : null;
  const startNode =
    (resumeNodeId && hasReply && nodeById.get(resumeNodeId)) || matchedStartNode || fallbackStartNode;
  if (!startNode) return [];

  const path: FlowNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startNode.id;
  let guard = 0;

  while (currentId && guard < 500) {
    guard += 1;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node = nodeById.get(currentId);
    if (!node) break;
    if (node.type === BACK_TO_MAIN_MENU_NODE_TYPE) {
      const targetMenuNodeId = String(node.data?.menuNodeId || '').trim();
      if (!targetMenuNodeId || !nodeById.has(targetMenuNodeId)) {
        break;
      }
      path.push(node);
      visited.delete(targetMenuNodeId);
      currentReplyId = '';
      currentReplyTitle = '';
      currentId = targetMenuNodeId;
      continue;
    }
    if (node.type === 'triggerKeyword' && !keywordNodeMatches(node, variables)) {
      return [];
    }
    if (node.type === 'logicCondition' && !conditionNodeMatches(node, variables)) {
      return [];
    }
    if (node.type === 'actionSendMessage') {
      const data = node.data || {};
      const messageType = String(data.messageType || '').trim().toLowerCase();
      const buttons = normalizeNodeButtons(data);
      const hasInteractiveChoice =
        messageType === 'interactive_button' ||
        messageType === 'interactive_list' ||
        buttons.length > 0;

      if (hasInteractiveChoice) {
        if (!currentReplyId && !currentReplyTitle) {
          path.push(node);
          break; // Wait for user choice before moving to next node.
        }

        const edgeButtonRoutes = (edges || [])
          .filter((e) => e.source === node.id && String(e.sourceHandle || '').startsWith('btn:'))
          .reduce((acc, e) => {
            const key = String(e.sourceHandle || '').replace(/^btn:/, '').trim();
            if (key && !acc[key]) acc[key] = String(e.target);
            return acc;
          }, {} as Record<string, string>);
        const routes = (data.buttonRoutes && typeof data.buttonRoutes === 'object')
          ? data.buttonRoutes
          : {};
        let target: string | null = null;

        if (currentReplyId && edgeButtonRoutes[currentReplyId]) {
          target = String(edgeButtonRoutes[currentReplyId]);
        } else if (currentReplyId && routes[currentReplyId]) {
          target = String(routes[currentReplyId]);
        } else if (currentReplyTitle) {
          const btn = buttons.find((b) => b.title.toLowerCase() === currentReplyTitle.toLowerCase());
          if (btn?.id && edgeButtonRoutes[btn.id]) {
            target = String(edgeButtonRoutes[btn.id]);
          } else if (btn?.id && routes[btn.id]) {
            target = String(routes[btn.id]);
          }
        }

        if (target && nodeById.has(target)) {
          // Resume mode: skip re-executing the interactive node and jump directly.
          if (resumeNodeId && node.id === resumeNodeId) {
            currentId = target;
            continue;
          }
          path.push(node);
          currentReplyId = '';
          currentReplyTitle = '';
          currentId = target;
          continue;
        }

        // This node is interactive, but the current reply does not belong to it.
        // Do not fall through to a default outgoing edge; wait for this node's own click.
        path.push(node);
        break;
      }
    }

    path.push(node);
    if (String(node.type || '').startsWith('action')) {
      const mainMenuTargetNodeId = getMainMenuTargetNodeId(node, nodeById);
      if (mainMenuTargetNodeId) {
        visited.delete(mainMenuTargetNodeId);
        currentReplyId = '';
        currentReplyTitle = '';
        currentId = mainMenuTargetNodeId;
        continue;
      }
    }
    const next = outgoing.get(currentId) || [];
    if (next.length === 0) break;

    currentId = next[0];
  }

  return path.length > 0 ? path : resolveExecutionOrder(nodes, edges);
}

function isLikelyMetaMediaId(value: any): boolean {
  const v = String(value || '').trim();
  return /^\d{8,}$/.test(v);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  let executionLogId: string | null = null;
  try {
    await ensureCoreSchema();
    const internalToken = request.headers.get('x-internal-execution-token') || '';
    const internalEnabled =
      !!process.env.INTERNAL_EXECUTION_TOKEN &&
      internalToken === process.env.INTERNAL_EXECUTION_TOKEN;
    let userId: string | null = null;

    if (!internalEnabled) {
      const cookieStore = await cookies();
      const authToken = cookieStore.get('auth-token')?.value;

      if (!authToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      userId = await verifySession(authToken);
      if (!userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
    }

    const { id } = await params;
    const { phone, variables } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    const workflows = internalEnabled
      ? await sql`
          SELECT w.* FROM workflows w
          WHERE w.id = ${id}
          LIMIT 1
        `
      : await sql`
          SELECT w.* FROM workflows w
          INNER JOIN workspaces ws ON w.workspace_id = ws.id
          WHERE w.id = ${id} AND ws.owner_id = ${userId}
          LIMIT 1
        `;

    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflow = workflows[0];
    const workspaceId = workflow.workspace_id as string;
    const publicBaseUrl = resolvePublicBaseUrl(request);
    const nodes = toArray(workflow.nodes) as FlowNode[];
    const edges = toArray(workflow.edges) as FlowEdge[];
    const orderedNodes = resolveExecutionOrder(nodes, edges);
    const executionNodes = resolveExecutionPath(nodes, edges, variables || {});
    const allNodeTypes = orderedNodes.map((n) => n.type || '');
    const actionNodeTypes = allNodeTypes.filter((t) => t.startsWith('action'));
    const log: Array<Record<string, any>> = [];
    let replyAlreadyConsumed = false;
    executionLogId = randomUUID();

    await sql`
      INSERT INTO workflow_execution_logs (
        id, workspace_id, workflow_id, phone, trigger_source, status, executed_nodes, summary, details
      )
      VALUES (
        ${executionLogId},
        ${workspaceId},
        ${String(id)},
        ${String(phone)},
        ${internalEnabled ? 'webhook' : 'manual'},
        ${'started'},
        ${0},
        ${'Workflow execution started'},
        ${JSON.stringify({
          variables: variables || {},
          executionNodeIds: executionNodes.map((node) => node.id),
          executionNodeTypes: executionNodes.map((node) => node.type || ''),
        })}
      )
    `;

    for (const node of executionNodes) {
      const type = node.type || '';
      const data = node.data || {};

      const upsertCustomerAndLogOutbound = async (
        content: string | null,
        mediaUrl: string | null,
        messageType: string
      ) => {
        const customerRows = await sql`
          INSERT INTO customers (id, workspace_id, phone, metadata)
          VALUES (
            ${randomUUID()},
            ${workspaceId},
            ${String(phone)},
            ${JSON.stringify({ provider: 'own_bsp' })}
          )
          ON CONFLICT (workspace_id, phone)
          DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;
        const customerId = customerRows?.[0]?.id;
        if (!customerId) return;

        await sql`
          INSERT INTO messages (id, workspace_id, customer_id, direction, type, content, media_url)
          VALUES (
            ${randomUUID()},
            ${workspaceId},
            ${customerId},
            ${'outbound'},
            ${messageType},
            ${content},
            ${mediaUrl}
          )
        `;
      };

      if (type === 'actionSendMessage') {
        const messageType = String(data.messageType || '').trim().toLowerCase();
        const templateName = String(data.templateName || '').trim();
        const normalizedMessageType =
          messageType ||
          (templateName
            ? 'template'
            : (Array.isArray(data.buttons) && data.buttons.length > 0) || data.button1Title || data.button2Title
              ? 'interactive_button'
              : 'text');

        if (normalizedMessageType === 'template' && templateName) {
          const res = await queueOwnBspTemplateMessage({
            workspaceId,
            channel: 'whatsapp',
            recipient: String(phone),
            templateName,
            templateLanguage: data.templateLanguage || 'en_US',
            bodyText: data.message || variables?.message || '',
            payload: { source: 'workflow', workflowId: id, nodeId: node.id },
          });
          if (!res.success) {
            throw new Error(`Template queue failed on node ${node.id}: ${res.error || 'Unknown error'}`);
          }
          log.push({
            nodeId: node.id,
            type,
            status: 'queued_template',
            outboxId: res.outboxId || null,
            response: res,
          });
          await upsertCustomerAndLogOutbound(
            data.message || variables?.message || null,
            null,
            'template'
          );
        } else {
          const buttons = normalizeNodeButtons(data);
          const shouldUseListForButtons =
            (normalizedMessageType === 'interactive_button' || normalizedMessageType === 'text') &&
            buttons.length > 3;
          const finalMessageType = shouldUseListForButtons ? 'interactive_list' : normalizedMessageType;
          const listRowsJson =
            finalMessageType === 'interactive_list' && buttons.length > 0
              ? JSON.stringify(
                  buttons.slice(0, 10).map((b, idx) => ({
                    id: String(b.id || idx + 1),
                    title: String(b.title || `Option ${idx + 1}`),
                  }))
                )
              : (data.listRowsJson || null);
          if (
            (finalMessageType === 'interactive_button' || finalMessageType === 'interactive_list') &&
            buttons.length === 0 &&
            !String(data.listRowsJson || '').trim()
          ) {
            throw new Error(
              `Message queue failed on node ${node.id}: Add at least one button/list option before sending.`
            );
          }

          const res = await queueOwnBspMessage({
            workspaceId,
            channel: 'whatsapp',
            recipient: String(phone),
            message: data.message || variables?.message || '',
            messageType: finalMessageType,
            payload: {
              header: data.header || null,
              footer: data.footer || null,
              buttons: finalMessageType === 'interactive_button' ? buttons.slice(0, 3) : undefined,
              listButtonText: finalMessageType === 'interactive_list' ? (data.listButtonText || 'Choose') : null,
              listSectionTitle: finalMessageType === 'interactive_list' ? (data.listSectionTitle || 'Options') : null,
              listRowsJson,
              listRow1Id: data.listRow1Id || null,
              listRow1Title: data.listRow1Title || null,
              listRow1Description: data.listRow1Description || null,
              listRow2Id: data.listRow2Id || null,
              listRow2Title: data.listRow2Title || null,
              listRow2Description: data.listRow2Description || null,
              catalogId: data.catalogId || null,
              productRetailerId: data.productRetailerId || null,
              productItemsJson: data.productItemsJson || null,
              productSectionTitle: data.productSectionTitle || null,
              productItem1: data.productItem1 || null,
              productItem2: data.productItem2 || null,
              messageIdToRead: data.messageIdToRead || null,
              templateName: data.templateName || null,
              templateLanguage: data.templateLanguage || 'en_US',
              source: 'workflow',
              workflowId: id,
              nodeId: node.id,
            },
          });
          if (!res.success) {
            throw new Error(`Message queue failed on node ${node.id}: ${res.error || 'Unknown error'}`);
          }
          log.push({
            nodeId: node.id,
            type,
            status: 'queued_message',
            outboxId: res.outboxId || null,
            response: res,
          });
          await upsertCustomerAndLogOutbound(
            data.message || variables?.message || null,
            null,
            finalMessageType
          );

          const consumedReplyForThisNode =
            !replyAlreadyConsumed && replyMatchesInteractiveNode(node, variables || {});
          if (consumedReplyForThisNode) {
            replyAlreadyConsumed = true;
          }
          if (
            (finalMessageType === 'interactive_button' || finalMessageType === 'interactive_list') &&
            !consumedReplyForThisNode
          ) {
            await sql`
              DELETE FROM workflow_wait_states
              WHERE workspace_id = ${workspaceId}
                AND workflow_id = ${id}
                AND phone = ${String(phone)}
            `;
            await sql`
              INSERT INTO workflow_wait_states (workspace_id, workflow_id, node_id, phone, expires_at)
              VALUES (
                ${workspaceId},
                ${id},
                ${node.id},
                ${String(phone)},
                CURRENT_TIMESTAMP + INTERVAL '2 days'
              )
            `;
          }
        }
      }

      if (type === 'actionSendMedia') {
        const mediaItems = normalizeMediaItems(data, variables || {});
        if (mediaItems.length === 0) {
          throw new Error(`Media queue failed on node ${node.id}: Add at least one media item.`);
        }

        for (const [index, item] of mediaItems.entries()) {
          const mediaUrl = normalizeOutboundMediaUrl(String(item.mediaUrl || ''), publicBaseUrl);
          const mediaId = isLikelyMetaMediaId(item.metaMediaId) ? item.metaMediaId : null;
          const caption =
            item.caption || data.caption || data.message || variables?.message || `Media item ${index + 1}`;
          const res = await queueOwnBspMediaMessage({
            workspaceId,
            channel: 'whatsapp',
            recipient: String(phone),
            caption,
            mediaUrl,
            mediaType: item.mediaType || data.mediaType || 'media',
            payload: {
              mediaId,
              source: 'workflow',
              workflowId: id,
              nodeId: node.id,
              mediaIndex: index,
              mediaCount: mediaItems.length,
            },
          });
          if (!res.success) {
            throw new Error(`Media queue failed on node ${node.id} item ${index + 1}: ${res.error || 'Unknown error'}`);
          }
          log.push({
            nodeId: node.id,
            type,
            status: 'queued_media',
            mediaIndex: index,
            mediaCount: mediaItems.length,
            outboxId: res.outboxId || null,
            response: res,
          });
          await upsertCustomerAndLogOutbound(
            caption || null,
            mediaUrl || null,
            'media'
          );
        }
      }

      if (type === 'actionSaveContact') {
        const res = await upsertOwnBspContact({
          workspaceId,
          phone: String(data.phone || phone),
          name: data.name || variables?.name || 'Workflow Contact',
          provider: 'own_bsp',
        });
        if (!res.success) {
          throw new Error(`Contact save failed on node ${node.id}: ${res.error || 'Unknown error'}`);
        }
        log.push({ nodeId: node.id, type, status: 'saved_contact', response: res });
      }
    }

    if (log.length === 0) {
      const replyId = String((variables || {}).buttonReplyId || (variables || {}).buttonId || '').trim();
      const replyTitle = String((variables || {}).buttonReplyTitle || (variables || {}).buttonTitle || '').trim();
      const missingRouteSummary =
        replyId || replyTitle
          ? `No route configured for clicked option${replyTitle ? ` "${replyTitle}"` : ''}`
          : 'No supported action nodes were executed';
      const missingRouteDetails = {
        foundNodeTypes: allNodeTypes,
        foundActionNodeTypes: actionNodeTypes,
        supportedActionNodeTypes: ['actionSendMessage', 'actionSendMedia', 'actionSaveContact'],
        ...(replyId || replyTitle
          ? {
              clickedOptionId: replyId || null,
              clickedOptionTitle: replyTitle || null,
            }
          : {}),
      };
      await sql`
        UPDATE workflow_execution_logs
        SET
          status = ${'failed'},
          executed_nodes = ${0},
          summary = ${missingRouteSummary},
          details = ${JSON.stringify(missingRouteDetails)},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${executionLogId}
      `;
      return NextResponse.json(
        {
          success: false,
          error: missingRouteSummary,
          debug: missingRouteDetails,
        },
        { status: 400 }
      );
    }

    await sql`
      UPDATE workflow_execution_logs
      SET
        status = ${'completed'},
        executed_nodes = ${log.length},
        summary = ${`Workflow executed successfully (${log.length} node${log.length === 1 ? '' : 's'})`},
        details = ${JSON.stringify({
          log,
          executionNodeIds: executionNodes.map((node) => node.id),
          executionNodeTypes: executionNodes.map((node) => node.type || ''),
        })},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${executionLogId}
    `;

    return NextResponse.json({
      success: true,
      workflowId: id,
      executedNodes: log.length,
      log,
    });
  } catch (error: any) {
    if (executionLogId) {
      try {
        await sql`
          UPDATE workflow_execution_logs
          SET
            status = ${'failed'},
            summary = ${String(error?.message || 'Failed to execute workflow')},
            details = ${JSON.stringify({
              error: String(error?.message || 'Failed to execute workflow'),
              stack: String(error?.stack || ''),
            })},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${executionLogId}
        `;
      } catch {
        // Best-effort logging only.
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute workflow',
      },
      { status: 500 }
    );
  }
}

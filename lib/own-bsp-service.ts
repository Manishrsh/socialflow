import { randomUUID } from 'crypto';
import { ensureCoreSchema, sql } from '@/lib/db';
import axios from 'axios';
import { sendViaMeta } from '@/lib/meta-provider';
type ExecutionMode = 'simulate' | 'manual' | 'provider' | 'meta';

export interface OwnBspRuntimeConfig {
  executionMode: ExecutionMode;
  autoProcess: boolean;
  providerSendUrl: string;
  providerTimeoutMs: number;
  hasProviderSendUrl: boolean;
}

function parseWorkspaceSettings(settings: any): Record<string, any> {
  if (!settings) return {};
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings);
    } catch {
      return {};
    }
  }
  return settings;
}

function envDefaultConfig(): OwnBspRuntimeConfig {
  const executionMode = String(process.env.OWN_BSP_EXECUTION_MODE || 'simulate').toLowerCase();
  const autoProcess = String(process.env.OWN_BSP_AUTO_PROCESS || 'true').toLowerCase() === 'true';
  const providerSendUrl = String(process.env.OWN_BSP_PROVIDER_SEND_URL || '').trim();
  const providerTimeoutMs = Number(process.env.OWN_BSP_PROVIDER_TIMEOUT_MS || 15000);
  const normalizedMode: ExecutionMode = (['simulate', 'manual', 'provider', 'meta'].includes(executionMode)
    ? executionMode
    : 'simulate') as ExecutionMode;

  return {
    executionMode: normalizedMode,
    autoProcess,
    providerSendUrl,
    providerTimeoutMs,
    hasProviderSendUrl: !!providerSendUrl,
  };
}

export async function getOwnBspRuntimeInfo(workspaceId?: string): Promise<OwnBspRuntimeConfig> {
  const fallback = envDefaultConfig();
  if (!workspaceId) return fallback;
  try {
    await ensureCoreSchema();
    const rows = await sql`
      SELECT settings
      FROM workspaces
      WHERE id = ${workspaceId}
      LIMIT 1
    `;
    const settings = parseWorkspaceSettings(rows?.[0]?.settings);
    const ownBsp = settings?.ownBsp || {};
    const executionModeRaw = String(ownBsp.executionMode || fallback.executionMode).toLowerCase();
    const executionMode: ExecutionMode = (['simulate', 'manual', 'provider', 'meta'].includes(executionModeRaw)
      ? executionModeRaw
      : fallback.executionMode) as ExecutionMode;
    const providerSendUrl = String(ownBsp.providerSendUrl ?? fallback.providerSendUrl).trim();
    const providerTimeoutMs = Number(ownBsp.providerTimeoutMs ?? fallback.providerTimeoutMs) || 15000;
    const autoProcess =
      ownBsp.autoProcess === undefined
        ? fallback.autoProcess
        : String(ownBsp.autoProcess).toLowerCase() === 'true';

    return {
      executionMode,
      autoProcess,
      providerSendUrl,
      providerTimeoutMs,
      hasProviderSendUrl: !!providerSendUrl,
    };
  } catch {
    return fallback;
  }
}

function providerAccepted(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return true;
  if (payload.success === false) return false;
  if (payload.status === false) return false;
  if (typeof payload.status === 'string' && payload.status.toLowerCase() === 'error') return false;
  return true;
}

export async function processOutboxItem(outboxId: string): Promise<{
  success: boolean;
  status: 'sent' | 'failed' | 'queued';
  providerMessageId?: string | null;
  error?: string;
}> {
  try {
    await ensureCoreSchema();
    const rows = await sql`
      SELECT id, workspace_id, channel, recipient, message, media_url, message_type, payload, status
      FROM own_bsp_outbox
      WHERE id = ${outboxId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return { success: false, status: 'failed', error: 'Outbox item not found' };
    }

    const item = rows[0];
    if (String(item.status) !== 'queued') {
      return { success: true, status: item.status };
    }
    const runtime = await getOwnBspRuntimeInfo(String(item.workspace_id));

    const payload = typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : (item.payload || {});

    if (runtime.executionMode === 'meta') {
      const metaResult = await sendViaMeta({
        workspaceId: String(item.workspace_id),
        channel: String(item.channel).toLowerCase() === 'instagram' ? 'instagram' : 'whatsapp',
        recipient: String(item.recipient),
        message: item.message,
        mediaUrl: item.media_url,
        messageType: item.message_type,
        payload,
      });

      if (!metaResult.success) {
        await sql`
          UPDATE own_bsp_outbox
          SET status = ${'failed'}, error = ${String(metaResult.error || 'Meta send failed')}, sent_at = CURRENT_TIMESTAMP
          WHERE id = ${outboxId}
        `;
        return { success: false, status: 'failed', error: String(metaResult.error || 'Meta send failed') };
      }

      await sql`
        UPDATE own_bsp_outbox
        SET status = ${'sent'}, provider_message_id = ${metaResult.messageId || null}, error = ${null}, sent_at = CURRENT_TIMESTAMP
        WHERE id = ${outboxId}
      `;
      return { success: true, status: 'sent', providerMessageId: metaResult.messageId || null };
    }

    if (runtime.executionMode === 'manual' && !runtime.providerSendUrl) {
      return { success: true, status: 'queued' };
    }

    if (runtime.providerSendUrl) {
      try {
        const resp = await axios.post(
          runtime.providerSendUrl,
          {
            id: item.id,
            workspaceId: item.workspace_id,
            channel: item.channel,
            recipient: item.recipient,
            message: item.message,
            mediaUrl: item.media_url,
            messageType: item.message_type,
            payload,
          },
          { timeout: runtime.providerTimeoutMs }
        );

        if (!providerAccepted(resp.data)) {
          const errMsg =
            resp.data?.error || resp.data?.message || 'Provider rejected outbox message';
          await sql`
            UPDATE own_bsp_outbox
            SET status = ${'failed'}, error = ${String(errMsg)}, sent_at = CURRENT_TIMESTAMP
            WHERE id = ${outboxId}
          `;
          return { success: false, status: 'failed', error: String(errMsg) };
        }

        const providerMessageId =
          String(resp.data?.messageId || resp.data?.id || `provider_${Date.now()}`);
        await sql`
          UPDATE own_bsp_outbox
          SET status = ${'sent'}, provider_message_id = ${providerMessageId}, error = ${null}, sent_at = CURRENT_TIMESTAMP
          WHERE id = ${outboxId}
        `;
        return { success: true, status: 'sent', providerMessageId };
      } catch (e: any) {
        const errMsg = e?.response?.data?.error || e?.message || 'Provider send failed';
        await sql`
          UPDATE own_bsp_outbox
          SET status = ${'failed'}, error = ${String(errMsg)}, sent_at = CURRENT_TIMESTAMP
          WHERE id = ${outboxId}
        `;
        return { success: false, status: 'failed', error: String(errMsg) };
      }
    }

    // No provider URL: keep queued so UI doesn't show false "sent".
    const modeLabel = runtime.executionMode || 'simulate';
    const reason = `Not delivered: OWN_BSP_PROVIDER_SEND_URL is not configured (mode=${modeLabel}).`;
    await sql`
      UPDATE own_bsp_outbox
      SET status = ${'queued'}, provider_message_id = ${null}, error = ${reason}
      WHERE id = ${outboxId}
    `;
    return { success: true, status: 'queued', error: reason };
  } catch (error: any) {
    return { success: false, status: 'failed', error: error?.message || 'Process failed' };
  }
}

async function autoProcessIfEnabled(outboxId?: string | null): Promise<{
  status: 'queued' | 'sent' | 'failed';
  providerMessageId?: string | null;
  error?: string;
}> {
  if (!outboxId) {
    return { status: 'queued' };
  }
  const rows = await sql`
    SELECT workspace_id FROM own_bsp_outbox WHERE id = ${outboxId} LIMIT 1
  `;
  const workspaceId = rows?.[0]?.workspace_id ? String(rows[0].workspace_id) : '';
  const runtime = await getOwnBspRuntimeInfo(workspaceId);
  if (!runtime.autoProcess) return { status: 'queued' };

  const result = await processOutboxItem(outboxId);
  return {
    status: result.status,
    providerMessageId: result.providerMessageId || null,
    error: result.error,
  };
}

export async function queueOwnBspMessage(input: {
  workspaceId: string;
  channel: 'whatsapp' | 'instagram';
  recipient: string;
  message: string;
  messageType?: string;
  payload?: Record<string, any>;
}): Promise<{ success: boolean; outboxId?: string; status: string; error?: string }> {
  try {
    await ensureCoreSchema();
    const outboxId = randomUUID();

    await sql`
      INSERT INTO own_bsp_outbox (id, workspace_id, channel, recipient, message, message_type, payload, status)
      VALUES (
        ${outboxId},
        ${input.workspaceId},
        ${input.channel},
        ${input.recipient},
        ${input.message},
        ${input.messageType || 'text'},
        ${JSON.stringify(input.payload || {})},
        ${'queued'}
      )
    `;

    const processed = await autoProcessIfEnabled(outboxId);
    return {
      success: processed.status !== 'failed',
      outboxId,
      status: processed.status,
      error: processed.error,
    };
  } catch (error: any) {
    return { success: false, status: 'error', error: error?.message || 'Failed to queue message' };
  }
}

export async function queueOwnBspTemplateMessage(input: {
  workspaceId: string;
  channel: 'whatsapp' | 'instagram';
  recipient: string;
  templateName: string;
  templateLanguage?: string;
  bodyText?: string;
  payload?: Record<string, any>;
}): Promise<{ success: boolean; outboxId?: string; status: string; error?: string }> {
  try {
    await ensureCoreSchema();
    const outboxId = randomUUID();
    await sql`
      INSERT INTO own_bsp_outbox (id, workspace_id, channel, recipient, message, message_type, payload, status)
      VALUES (
        ${outboxId},
        ${input.workspaceId},
        ${input.channel},
        ${input.recipient},
        ${input.bodyText || null},
        ${'template'},
        ${JSON.stringify({
          templateName: input.templateName,
          templateLanguage: input.templateLanguage || 'en_US',
          ...(input.payload || {}),
        })},
        ${'queued'}
      )
    `;
    const processed = await autoProcessIfEnabled(outboxId);
    return {
      success: processed.status !== 'failed',
      outboxId,
      status: processed.status,
      error: processed.error,
    };
  } catch (error: any) {
    return { success: false, status: 'error', error: error?.message || 'Failed to queue template' };
  }
}

export async function queueOwnBspMediaMessage(input: {
  workspaceId: string;
  channel: 'whatsapp' | 'instagram';
  recipient: string;
  caption?: string;
  mediaUrl: string;
  mediaType?: string;
  payload?: Record<string, any>;
}): Promise<{ success: boolean; outboxId?: string; status: string; error?: string }> {
  try {
    await ensureCoreSchema();
    const outboxId = randomUUID();
    await sql`
      INSERT INTO own_bsp_outbox (id, workspace_id, channel, recipient, message, media_url, message_type, payload, status)
      VALUES (
        ${outboxId},
        ${input.workspaceId},
        ${input.channel},
        ${input.recipient},
        ${input.caption || null},
        ${input.mediaUrl},
        ${input.mediaType || 'media'},
        ${JSON.stringify(input.payload || {})},
        ${'queued'}
      )
    `;
    const processed = await autoProcessIfEnabled(outboxId);
    return {
      success: processed.status !== 'failed',
      outboxId,
      status: processed.status,
      error: processed.error,
    };
  } catch (error: any) {
    return { success: false, status: 'error', error: error?.message || 'Failed to queue media' };
  }
}

export async function upsertOwnBspContact(input: {
  workspaceId: string;
  phone: string;
  name?: string;
  provider?: string;
}): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    await ensureCoreSchema();
    const rows = await sql`
      INSERT INTO customers (id, workspace_id, phone, name, metadata)
      VALUES (
        ${randomUUID()},
        ${input.workspaceId},
        ${input.phone},
        ${input.name || null},
        ${JSON.stringify({ provider: input.provider || 'own_bsp' })}
      )
      ON CONFLICT (workspace_id, phone)
      DO UPDATE SET
        name = COALESCE(${input.name || null}, customers.name),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    return { success: true, customerId: rows?.[0]?.id };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to upsert contact' };
  }
}

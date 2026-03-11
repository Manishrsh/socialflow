import axios from 'axios';

const WPBOX_BASE_URL =
  process.env.WPBOX_BASE_URL || 'https://chat.leminai.com/api/wpbox';
const WPBOX_TOKEN = process.env.WPBOX_TOKEN;
const WPBOX_USER_ID = process.env.WPBOX_USER_ID;
const WPBOX_TIMEOUT_MS = Number(process.env.WPBOX_TIMEOUT_MS || 30000);

type JsonObject = Record<string, any>;
type HttpMethod = 'GET' | 'POST';

export interface WpboxTrace {
  id: string;
  timestamp: string;
  method: HttpMethod;
  endpoint: string;
  url: string;
  request: JsonObject;
  responseStatus?: number;
  responseBody?: any;
  error?: string;
}

const traceStore: WpboxTrace[] = [];
const MAX_TRACES = 200;

function maskSensitive(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(maskSensitive);

  const cloned: JsonObject = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.toLowerCase().includes('token') && typeof v === 'string') {
      cloned[k] = `${v.slice(0, 4)}...${v.slice(-4)}`;
    } else {
      cloned[k] = maskSensitive(v);
    }
  }
  return cloned;
}

function pushTrace(trace: WpboxTrace) {
  traceStore.unshift(trace);
  if (traceStore.length > MAX_TRACES) {
    traceStore.length = MAX_TRACES;
  }
}

function newTraceBase(method: HttpMethod, endpoint: string, request: JsonObject): WpboxTrace {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    url: `${WPBOX_BASE_URL}/${endpoint}`,
    request: maskSensitive(request || {}),
  };
}

export function getWpboxTraces(limit = 50): WpboxTrace[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
  return traceStore.slice(0, safeLimit);
}

function normalizeButtons(
  buttons?: Array<{ id?: string | number; title?: string }>
): Array<{ id: string | number; title: string }> | undefined {
  if (!Array.isArray(buttons) || buttons.length === 0) return undefined;

  const normalized = buttons
    .map((b, idx) => {
      const title = String(b?.title || '').trim();
      if (!title) return null;
      const rawId = b?.id ?? idx + 1;
      const idAsString = String(rawId).trim();
      const id = /^\d+$/.test(idAsString) ? Number(idAsString) : idAsString;
      return { id, title };
    })
    .filter(Boolean) as Array<{ id: string | number; title: string }>;

  return normalized.length > 0 ? normalized.slice(0, 2) : undefined;
}

function getToken(token?: string): string {
  const finalToken = token || WPBOX_TOKEN;
  if (!finalToken) {
    throw new Error('WPBOX token is not configured');
  }
  return finalToken;
}

function getUserId(userId?: string): string {
  const finalUserId = userId || WPBOX_USER_ID;
  if (!finalUserId) {
    throw new Error('WPBOX user id is not configured');
  }
  return finalUserId;
}

async function wpboxGet<T>(endpoint: string, params: JsonObject): Promise<T> {
  const trace = newTraceBase('GET', endpoint, params);
  try {
    const response = await axios.get(trace.url, { params, timeout: WPBOX_TIMEOUT_MS });
    trace.responseStatus = response.status;
    trace.responseBody = response.data;
    pushTrace(trace);
    return response.data as T;
  } catch (error: any) {
    trace.responseStatus = error?.response?.status;
    trace.responseBody = error?.response?.data;
    trace.error = error?.message || 'WPBox GET failed';
    pushTrace(trace);
    throw error;
  }
}

async function wpboxPost<T>(endpoint: string, payload: JsonObject): Promise<T> {
  const result = await wpboxPostWithTrace<T>(endpoint, payload);
  return result.data;
}

async function wpboxPostWithTrace<T>(
  endpoint: string,
  payload: JsonObject
): Promise<{ data: T; traceId: string }> {
  const trace = newTraceBase('POST', endpoint, payload);
  try {
    const requestConfig = {
      headers: { 'Content-Type': 'application/json' },
      timeout: WPBOX_TIMEOUT_MS,
    };
    let response;
    try {
      response = await axios.post(trace.url, payload, requestConfig);
    } catch (error: any) {
      const timedOut =
        error?.code === 'ECONNABORTED' ||
        String(error?.message || '').toLowerCase().includes('timeout');
      if (!timedOut) throw error;
      // Retry once on timeout; providers can be intermittently slow.
      response = await axios.post(trace.url, payload, requestConfig);
    }
    trace.responseStatus = response.status;
    trace.responseBody = response.data;
    pushTrace(trace);
    return { data: response.data as T, traceId: trace.id };
  } catch (error: any) {
    trace.responseStatus = error?.response?.status;
    trace.responseBody = error?.response?.data;
    const timedOut =
      error?.code === 'ECONNABORTED' ||
      String(error?.message || '').toLowerCase().includes('timeout');
    trace.error = timedOut
      ? `WPBox timeout after ${WPBOX_TIMEOUT_MS}ms`
      : (error?.message || 'WPBox POST failed');
    pushTrace(trace);
    throw error;
  }
}

export async function getWpboxTemplates(options?: {
  token?: string;
  userId?: string;
}): Promise<any> {
  return wpboxGet('getTemplates', {
    token: getToken(options?.token),
    user_id: getUserId(options?.userId),
  });
}

export async function sendWpboxMessage(input: {
  phone: string;
  message: string;
  header?: string;
  footer?: string;
  buttons?: Array<{ id: string | number; title: string }>;
  token?: string;
}): Promise<any> {
  const buttons = normalizeButtons(input.buttons);
  return wpboxPost('sendmessage', {
    token: getToken(input.token),
    phone: input.phone,
    message: input.message,
    header: input.header || undefined,
    footer: input.footer || undefined,
    buttons,
  });
}

export async function sendWpboxMessageDetailed(input: {
  phone: string;
  message: string;
  header?: string;
  footer?: string;
  buttons?: Array<{ id: string | number; title: string }>;
  token?: string;
}): Promise<{ data: any; traceId: string }> {
  const buttons = normalizeButtons(input.buttons);
  return wpboxPostWithTrace('sendmessage', {
    token: getToken(input.token),
    phone: input.phone,
    message: input.message,
    header: input.header || undefined,
    footer: input.footer || undefined,
    buttons,
  });
}

export async function sendWpboxTemplateMessage(input: {
  phone: string;
  templateName: string;
  templateLanguage?: string;
  bodyText?: string;
  token?: string;
}): Promise<any> {
  const components = input.bodyText
    ? [
        {
          type: 'BODY',
          parameters: [{ type: 'text', text: input.bodyText }],
        },
      ]
    : undefined;

  return wpboxPost('sendtemplatemessage', {
    token: getToken(input.token),
    phone: input.phone,
    template_name: input.templateName,
    template_language: input.templateLanguage || 'en_US',
    components,
  });
}

export async function sendWpboxTemplateMessageDetailed(input: {
  phone: string;
  templateName: string;
  templateLanguage?: string;
  bodyText?: string;
  token?: string;
}): Promise<{ data: any; traceId: string }> {
  const components = input.bodyText
    ? [
        {
          type: 'BODY',
          parameters: [{ type: 'text', text: input.bodyText }],
        },
      ]
    : undefined;

  return wpboxPostWithTrace('sendtemplatemessage', {
    token: getToken(input.token),
    phone: input.phone,
    template_name: input.templateName,
    template_language: input.templateLanguage || 'en_US',
    components,
  });
}

export async function getWpboxContacts(options?: {
  token?: string;
}): Promise<any> {
  return wpboxGet('getContacts', {
    token: getToken(options?.token),
  });
}

export async function createWpboxContact(input: {
  phone: string;
  name: string;
  groups?: string;
  custom?: Record<string, string>;
  token?: string;
}): Promise<any> {
  return wpboxPost('makeContact', {
    token: getToken(input.token),
    phone: input.phone,
    name: input.name,
    groups: input.groups || undefined,
    custom: input.custom || undefined,
  });
}

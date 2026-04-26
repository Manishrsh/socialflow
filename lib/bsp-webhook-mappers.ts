export interface NormalizedInboundEvent {
  provider: string;
  eventType: string;
  phone?: string;
  message?: string;
  mediaUrl?: string;
  externalMessageId?: string;
  buttonReplyId?: string;
  buttonReplyTitle?: string;
  flowToken?: string;
  flowReply?: Record<string, any>;
  raw: any;
}

function normalizePhone(value: unknown): string | undefined {
  const input = String(value || '').trim();
  if (!input) return undefined;
  const cleaned = input
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
  return cleaned || undefined;
}

function pickFirst(...vals: any[]): any {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function mapGupshup(body: any): Partial<NormalizedInboundEvent> {
  const payload = body?.payload || body;
  const sender = payload?.sender || {};
  const message = payload?.payload || payload?.message || {};

  const phone = normalizePhone(
    pickFirst(sender?.phone, payload?.sender?.phone, body?.phone, body?.from)
  );

  const messageText = pickFirst(
    message?.text,
    payload?.text,
    body?.text,
    body?.message
  );

  const mediaUrl = pickFirst(
    message?.url,
    message?.media?.url,
    payload?.media?.url,
    body?.mediaUrl
  );

  return {
    eventType: String(pickFirst(body?.type, body?.event, payload?.type) || 'message'),
    phone,
    message: messageText ? String(messageText) : undefined,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    externalMessageId: pickFirst(payload?.id, body?.messageId, body?.gsId),
  };
}

function mapTwilio(body: any): Partial<NormalizedInboundEvent> {
  // Twilio sends x-www-form-urlencoded by default.
  const phone = normalizePhone(pickFirst(body?.WaId, body?.From, body?.from));
  const message = pickFirst(body?.Body, body?.body, body?.Message);
  const mediaUrl = pickFirst(body?.MediaUrl0, body?.mediaUrl, body?.NumMedia > 0 ? body?.MediaUrl0 : undefined);

  return {
    eventType: 'message',
    phone,
    message: message ? String(message) : undefined,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    externalMessageId: pickFirst(body?.MessageSid, body?.SmsSid),
  };
}

function map360dialog(body: any): Partial<NormalizedInboundEvent> {
  const value = body?.entry?.[0]?.changes?.[0]?.value || body?.value || {};
  const msg = value?.messages?.[0] || {};
  const status = value?.statuses?.[0] || {};
  const contact = value?.contacts?.[0] || {};

  const phone = normalizePhone(pickFirst(msg?.from, status?.recipient_id, contact?.wa_id, body?.from));
  const message = pickFirst(
    msg?.text?.body,
    msg?.button?.text,
    msg?.interactive?.button_reply?.title,
    msg?.interactive?.list_reply?.title
  );
  const flowReplyRaw = msg?.interactive?.nfm_reply?.response_json;
  const flowReply =
    flowReplyRaw && typeof flowReplyRaw === 'string'
      ? (() => {
          try {
            return JSON.parse(flowReplyRaw);
          } catch {
            return { raw: flowReplyRaw };
          }
        })()
      : (flowReplyRaw && typeof flowReplyRaw === 'object' ? flowReplyRaw : undefined);
  const flowReplySummary = flowReply
    ? pickFirst(
        flowReply?.flow_response_message,
        flowReply?.summary,
        flowReply?.appointment_summary,
        flowReply?.service,
        'Submitted WhatsApp form'
      )
    : undefined;
  const mediaUrl = pickFirst(
    msg?.image?.link,
    msg?.video?.link,
    msg?.document?.link,
    msg?.audio?.link,
    msg?.sticker?.link
  );

  return {
    eventType: String(pickFirst(msg?.type, status?.status, body?.event, 'message')),
    phone,
    message: message ? String(message) : flowReplySummary ? String(flowReplySummary) : undefined,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    externalMessageId: pickFirst(msg?.id, status?.id, body?.messageId),
    buttonReplyId: pickFirst(msg?.interactive?.button_reply?.id, msg?.interactive?.list_reply?.id),
    buttonReplyTitle: pickFirst(msg?.interactive?.button_reply?.title, msg?.interactive?.list_reply?.title),
    flowToken: pickFirst(msg?.interactive?.nfm_reply?.body, flowReply?.flow_token, flowReply?.flowToken),
    flowReply: flowReply ? flowReply : undefined,
  };
}

function mapInstagram(body: any): Partial<NormalizedInboundEvent> {
  // Meta Instagram Messaging webhooks are similar to WhatsApp Cloud webhooks.
  const entry = body?.entry?.[0] || {};
  const value = entry?.changes?.[0]?.value || {};
  const msg =
    value?.messages?.[0] ||
    entry?.messaging?.[0]?.message ||
    body?.messaging?.[0]?.message ||
    {};
  const contact = value?.contacts?.[0] || entry?.messaging?.[0]?.sender || body?.sender || {};
  const recipient = entry?.messaging?.[0]?.recipient || body?.recipient || {};

  const phone = normalizePhone(
    pickFirst(
      msg?.from,
      contact?.wa_id,
      contact?.id,
      body?.from,
      body?.sender?.id,
      recipient?.id
    )
  );
  const message = pickFirst(
    msg?.text?.body,
    msg?.text,
    msg?.button?.text,
    msg?.quick_reply?.title,
    msg?.interactive?.button_reply?.title,
    body?.message?.text,
    body?.message
  );
  const mediaUrl = pickFirst(
    msg?.image?.link,
    msg?.video?.link,
    msg?.audio?.link,
    msg?.document?.link,
    msg?.attachments?.[0]?.payload?.url,
    body?.attachments?.[0]?.payload?.url
  );

  return {
    eventType: String(pickFirst(msg?.type, body?.object, body?.event, 'message')),
    phone,
    message: message ? String(message) : undefined,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    buttonReplyId: pickFirst(msg?.quick_reply?.payload),
    buttonReplyTitle: pickFirst(msg?.quick_reply?.title, msg?.text),
    externalMessageId: pickFirst(msg?.mid, msg?.id, body?.mid, body?.messageId),
  };
}

function mapGeneric(body: any): Partial<NormalizedInboundEvent> {
  return {
    eventType: String(pickFirst(body?.event, body?.type, body?.eventType, 'message')),
    phone: normalizePhone(
      pickFirst(
        body?.phone,
        body?.from,
        body?.sender,
        body?.contact?.phone,
        body?.data?.phone,
        body?.data?.from
      )
    ),
    message: pickFirst(body?.message, body?.text, body?.body, body?.data?.message, body?.data?.text),
    mediaUrl: pickFirst(
      body?.mediaUrl,
      body?.media_url,
      body?.image,
      body?.video,
      body?.document,
      body?.data?.mediaUrl
    ),
    externalMessageId: pickFirst(body?.messageId, body?.id),
  };
}

export function mapInboundEvent(providerInput: string, body: any): NormalizedInboundEvent {
  const provider = String(providerInput || 'generic').toLowerCase();
  let mapped: Partial<NormalizedInboundEvent>;

  switch (provider) {
    case 'gupshup':
      mapped = mapGupshup(body);
      break;
    case 'twilio':
      mapped = mapTwilio(body);
      break;
    case '360dialog':
      mapped = map360dialog(body);
      break;
    case 'meta':
      mapped = String(body?.entry?.[0]?.changes?.[0]?.value?.messaging_product || body?.messaging_product || '')
        .trim()
        .toLowerCase() === 'instagram'
        ? mapInstagram(body)
        : map360dialog(body);
      break;
    case 'instagram':
      mapped = mapInstagram(body);
      break;
    default:
      mapped = mapGeneric(body);
      break;
  }

  return {
    provider,
    eventType: mapped.eventType || 'message',
    phone: mapped.phone,
    message: mapped.message ? String(mapped.message) : undefined,
    mediaUrl: mapped.mediaUrl ? String(mapped.mediaUrl) : undefined,
    externalMessageId: mapped.externalMessageId ? String(mapped.externalMessageId) : undefined,
    buttonReplyId: mapped.buttonReplyId ? String(mapped.buttonReplyId) : undefined,
    buttonReplyTitle: mapped.buttonReplyTitle ? String(mapped.buttonReplyTitle) : undefined,
    flowToken: mapped.flowToken ? String(mapped.flowToken) : undefined,
    flowReply:
      mapped.flowReply && typeof mapped.flowReply === 'object' && !Array.isArray(mapped.flowReply)
        ? mapped.flowReply
        : undefined,
    raw: body,
  };
}

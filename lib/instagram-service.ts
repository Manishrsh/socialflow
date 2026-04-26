import axios from 'axios';

const IG_GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v25.0';
const IG_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_TIMEOUT_MS = Number(process.env.INSTAGRAM_TIMEOUT_MS || 30000);

function nonEmpty(value: any): string {
  return String(value || '').trim();
}

function sanitizeSecret(value: any): string {
  return nonEmpty(value).replace(/\s+/g, '');
}

function clamp(value: any, max: number): string {
  return nonEmpty(value).slice(0, max);
}

function parseJsonArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  const text = nonEmpty(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeButtons(payload?: Record<string, any>): Array<{ id: string; title: string }> {
  const buttons = Array.isArray(payload?.buttons) ? payload?.buttons : [];
  return buttons
    .filter((b: any) => b && nonEmpty(b.id) && nonEmpty(b.title))
    .slice(0, 10)
    .map((b: any) => ({ id: clamp(b.id, 256), title: clamp(b.title, 20) }));
}

function normalizeListRows(payload?: Record<string, any>): Array<{ id: string; title: string; description?: string }> {
  const rows = parseJsonArray(payload?.listRowsJson);
  return rows
    .map((row: any, idx: number) => ({
      id: clamp(row?.id || idx + 1, 200),
      title: clamp(row?.title || `Option ${idx + 1}`, 24),
      ...(nonEmpty(row?.description) ? { description: clamp(row.description, 72) } : {}),
    }))
    .filter((row) => row.id && row.title)
    .slice(0, 10);
}

function normalizeTemplateElements(payload?: Record<string, any>): Array<Record<string, any>> {
  const elements = parseJsonArray(payload?.elements);
  return elements
    .map((element: any) => {
      const title = nonEmpty(element?.title);
      const subtitle = nonEmpty(element?.subtitle);
      const imageUrl = nonEmpty(element?.image_url || element?.imageUrl);
      const buttons = Array.isArray(element?.buttons) ? element.buttons : [];

      const normalizedButtons = buttons
        .map((button: any) => ({
          type: nonEmpty(button?.type || 'web_url').toLowerCase(),
          url: nonEmpty(button?.url),
          title: clamp(button?.title, 20),
        }))
        .filter((button: any) => button.title);

      const normalized: Record<string, any> = {};
      if (title) normalized.title = clamp(title, 80);
      if (subtitle) normalized.subtitle = clamp(subtitle, 80);
      if (imageUrl) normalized.image_url = imageUrl;
      if (normalizedButtons.length > 0) normalized.buttons = normalizedButtons;
      return normalized;
    })
    .filter((element) => element.title || element.image_url || element.subtitle)
    .slice(0, 10);
}

function buildTemplateButtons(payload?: Record<string, any>): Array<{ type: string; url: string; title: string }> {
  const buttons = normalizeButtons(payload);
  return buttons
    .map((button) => {
      const url = nonEmpty((payload || {})[button.id] || '');
      const resolvedUrl = url || nonEmpty((payload || {}).defaultUrl) || '';
      return {
        type: 'web_url',
        url: resolvedUrl,
        title: button.title,
      };
    })
    .filter((button) => button.url && button.title)
    .slice(0, 3);
}

function buildQuickReplies(payload?: Record<string, any>): Array<{ content_type: string; title: string; payload: string }> {
  const buttonOptions = normalizeButtons(payload).map((button) => ({
    title: button.title,
    payload: button.id,
  }));
  const listOptions = normalizeListRows(payload).map((row) => ({
    title: row.title,
    payload: row.id,
  }));

  const options = buttonOptions.length > 0 ? buttonOptions : listOptions;

  return options
    .filter((option) => option.title && option.payload)
    .slice(0, 13)
    .map((option) => ({
      content_type: 'text',
      title: clamp(option.title, 20),
      payload: clamp(option.payload, 256),
    }));
}

function buildGenericTemplateElement(input: {
  message?: string | null;
  mediaUrl?: string | null;
  payload?: Record<string, any>;
}): Record<string, any> {
  const payload = input.payload || {};
  const buttons = buildTemplateButtons(payload);
  const title =
    nonEmpty(payload.title) ||
    nonEmpty(payload.header) ||
    nonEmpty(payload.message) ||
    nonEmpty(input.message) ||
    'Message';
  const subtitle =
    nonEmpty(payload.subtitle) ||
    [
      nonEmpty(payload.footer),
      buildTextChoiceMessage({
        message: input.message || null,
        payload,
        messageType: 'interactive_button',
      }),
    ]
      .filter(Boolean)
      .join('\n');

  const element: Record<string, any> = {
    title: clamp(title, 80),
  };

  if (input.mediaUrl) {
    element.image_url = input.mediaUrl;
  }

  if (subtitle) {
    element.subtitle = clamp(subtitle, 80);
  }

  if (buttons.length > 0) {
    element.buttons = buttons;
  }

  return element;
}

function buildTextChoiceMessage(input: {
  message?: string | null;
  payload?: Record<string, any>;
  messageType?: string | null;
}): string {
  const messageType = nonEmpty(input.messageType || '').toLowerCase();
  const payload = input.payload || {};
  const header = nonEmpty(payload.header);
  const body = nonEmpty(input.message || payload.message || 'Please choose an option');
  const footer = nonEmpty(payload.footer);
  const buttons = normalizeButtons(payload);
  const rows = normalizeListRows(payload);
  const options = buttons.length > 0
    ? buttons.map((button, index) => `${index + 1}. ${button.title}`)
    : rows.length > 0
      ? rows.map((row, index) => `${index + 1}. ${row.title}`)
      : [];

  const parts = [header, body, ...options, footer].filter(Boolean);

  if (messageType === 'interactive_button' || messageType === 'interactive_list' || options.length > 0) {
    return parts.join('\n');
  }

  return body || 'Hello';
}

export async function sendInstagramMessage(input: {
  recipientId: string;
  message?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  messageType?: string | null;
  payload?: Record<string, any>;
  credentials?: {
    businessAccountId?: string | null;
    accessToken?: string | null;
    graphApiVersion?: string | null;
  };
}): Promise<{ success: boolean; id?: string; error?: string; raw?: any }> {
  try {
    const businessAccountId = sanitizeSecret(input.credentials?.businessAccountId || IG_BUSINESS_ACCOUNT_ID);
    const accessToken = sanitizeSecret(input.credentials?.accessToken || IG_ACCESS_TOKEN);
    const graphApiVersion = nonEmpty(input.credentials?.graphApiVersion || IG_GRAPH_API_VERSION);
    console.log('[Instagram Service] Preparing send', {
      recipientId: nonEmpty(input.recipientId),
      messageType: nonEmpty(input.messageType || 'text'),
      hasMessage: !!nonEmpty(input.message),
      hasMediaUrl: !!nonEmpty(input.mediaUrl),
      hasPayload: !!input.payload,
      hasBusinessAccountId: !!businessAccountId,
      hasAccessToken: !!accessToken,
      graphApiVersion,
    });

    if (!businessAccountId || !accessToken) {
      console.error('[Instagram Service] Missing Instagram credentials', {
        hasBusinessAccountId: !!businessAccountId,
        hasAccessToken: !!accessToken,
      });
      return {
        success: false,
        error: 'Instagram API credentials are not configured',
      };
    }

    // Instagram Messaging send uses the Instagram Graph endpoint with the IG-scoped recipient id.
    const url = `https://graph.instagram.com/${graphApiVersion}/me/messages`;
    const messageType = nonEmpty(input.messageType || 'text').toLowerCase();
    const text = nonEmpty(input.message);
    const mediaUrl = nonEmpty(input.mediaUrl);
    const mediaType = ['image', 'video', 'audio', 'document'].includes(nonEmpty(input.mediaType).toLowerCase())
      ? nonEmpty(input.mediaType).toLowerCase()
      : 'image';

    const body: Record<string, any> = {
      recipient: { id: input.recipientId },
      messaging_type: 'RESPONSE',
    };

    const templateElements = normalizeTemplateElements(input.payload);
    const genericTemplateElement = buildGenericTemplateElement({
      message: input.message || null,
      mediaUrl: mediaUrl || null,
      payload: input.payload || {},
    });
    const templateButtons = buildTemplateButtons(input.payload);
    const quickReplies = buildQuickReplies(input.payload);
    const isChoiceMessage = messageType === 'interactive_button' || messageType === 'interactive_list';
    const wantsTemplate =
      messageType === 'template' ||
      nonEmpty(input.payload?.templateType).toLowerCase() === 'generic' ||
      templateElements.length > 0 ||
      templateButtons.length > 0 ||
      !!mediaUrl ||
      (isChoiceMessage && templateButtons.length > 0);

    if (wantsTemplate) {
      body.message = {
        attachment: {
          type: 'template',
          payload: {
            template_type: nonEmpty(input.payload?.templateType || 'generic').toLowerCase(),
            elements:
              templateElements.length > 0
                ? templateElements
                : [genericTemplateElement],
          },
        },
      };
    } else if (mediaUrl && ['image', 'video', 'audio', 'document', 'media'].includes(messageType)) {
      body.message = {
        attachment: {
          type: mediaType,
          payload: {
            url: mediaUrl,
          },
        },
        ...(text ? { text } : {}),
      };
    } else {
      if (isChoiceMessage && quickReplies.length > 0) {
        console.log('[Instagram Service] Sending Instagram quick replies', {
          recipientId: nonEmpty(input.recipientId),
          messageType,
          quickReplyCount: quickReplies.length,
        });
        body.message = {
          text: buildTextChoiceMessage({
            message: text,
            payload: input.payload || {},
            messageType,
          }),
          quick_replies: quickReplies,
        };
      } else {
        if (isChoiceMessage) {
          console.log('[Instagram Service] Falling back to text choices for Instagram buttons', {
            recipientId: nonEmpty(input.recipientId),
            messageType,
            buttonCount: normalizeButtons(input.payload).length,
          });
        }
        body.message = {
          text: buildTextChoiceMessage({
            message: text,
            payload: input.payload || {},
            messageType,
          }),
        };
      }
    }

    const response = await axios.post(
      url,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: IG_TIMEOUT_MS,
      }
    );
    console.log('[Instagram Service] Send success', {
      recipientId: nonEmpty(input.recipientId),
      status: response.status,
      messageId: response.data?.message_id || response.data?.id || null,
    });

    return {
      success: true,
      id: response.data?.message_id || response.data?.id,
      raw: response.data,
    };
  } catch (error: any) {
    console.error('[Instagram Service] Send failed', {
      recipientId: nonEmpty(input.recipientId),
      messageType: nonEmpty(input.messageType || 'text'),
      status: error?.response?.status || null,
      error: error?.message || String(error),
      responseData: error?.response?.data || null,
    });
    return {
      success: false,
      error:
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to send Instagram message',
      raw: error?.response?.data,
    };
  }
}

export async function sendInstagramTextMessage(input: {
  recipientId: string;
  message: string;
}): Promise<{ success: boolean; id?: string; error?: string; raw?: any }> {
  return sendInstagramMessage(input);
}

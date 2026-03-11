import axios from 'axios';
import { ensureCoreSchema, sql } from '@/lib/db';

type Channel = 'whatsapp' | 'instagram';

interface MetaSendInput {
  workspaceId: string;
  channel: Channel;
  recipient: string;
  message?: string | null;
  mediaUrl?: string | null;
  messageType?: string | null;
  payload?: Record<string, any>;
}

interface MetaCredentials {
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  instagramBusinessAccountId: string;
  instagramAccessToken: string;
  graphApiVersion: string;
}

function nonEmpty(value: any): string {
  return String(value || '').trim();
}

async function loadWorkspaceMetaCredentials(workspaceId: string): Promise<Partial<MetaCredentials>> {
  await ensureCoreSchema();
  const rows = await sql`
    SELECT
      whatsapp_phone_number_id,
      whatsapp_access_token,
      instagram_business_account_id,
      instagram_access_token
    FROM meta_apps
    WHERE workspace_id = ${workspaceId}
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `;
  const r = rows?.[0];
  if (!r) return {};
  return {
    whatsappPhoneNumberId: nonEmpty(r.whatsapp_phone_number_id),
    whatsappAccessToken: nonEmpty(r.whatsapp_access_token),
    instagramBusinessAccountId: nonEmpty(r.instagram_business_account_id),
    instagramAccessToken: nonEmpty(r.instagram_access_token),
  };
}

async function resolveMetaCredentials(workspaceId: string): Promise<MetaCredentials> {
  const fromWorkspace = await loadWorkspaceMetaCredentials(workspaceId);

  return {
    whatsappPhoneNumberId:
      fromWorkspace.whatsappPhoneNumberId || nonEmpty(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
    whatsappAccessToken:
      fromWorkspace.whatsappAccessToken || nonEmpty(process.env.META_WHATSAPP_ACCESS_TOKEN),
    instagramBusinessAccountId:
      fromWorkspace.instagramBusinessAccountId ||
      nonEmpty(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
    instagramAccessToken:
      fromWorkspace.instagramAccessToken || nonEmpty(process.env.INSTAGRAM_ACCESS_TOKEN),
    graphApiVersion: nonEmpty(process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'),
  };
}

function normalizeButtons(payload?: Record<string, any>): Array<{ id: string; title: string }> {
  const buttons = Array.isArray(payload?.buttons) ? payload?.buttons : [];
  return buttons
    .filter((b: any) => b && nonEmpty(b.id) && nonEmpty(b.title))
    .slice(0, 10)
    .map((b: any) => ({ id: String(b.id), title: String(b.title).slice(0, 24) }));
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

export async function sendViaMeta(input: MetaSendInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const creds = await resolveMetaCredentials(input.workspaceId);

    if (input.channel === 'whatsapp') {
      if (!creds.whatsappPhoneNumberId || !creds.whatsappAccessToken) {
        return {
          success: false,
          error: 'Missing META WhatsApp credentials. Set phone number ID and access token.',
        };
      }

      const url = `https://graph.facebook.com/${creds.graphApiVersion}/${creds.whatsappPhoneNumberId}/messages`;
      const buttons = normalizeButtons(input.payload);
      const messageType = nonEmpty(input.messageType || 'text').toLowerCase();
      const text = nonEmpty(input.message);
      const mediaId = nonEmpty(input.payload?.mediaId);
      const mediaLink = nonEmpty(input.mediaUrl);
      const templateName = nonEmpty(input.payload?.templateName);
      const templateLanguage = nonEmpty(input.payload?.templateLanguage || 'en_US');
      const catalogId = nonEmpty(input.payload?.catalogId);
      const productRetailerId = nonEmpty(input.payload?.productRetailerId);
      const markReadMessageId = nonEmpty(input.payload?.messageIdToRead || input.payload?.messageId);

      let body: any = {
        messaging_product: 'whatsapp',
        to: nonEmpty(input.recipient),
      };

      if (messageType === 'read' && markReadMessageId) {
        body = {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: markReadMessageId,
        };
      } else if (messageType === 'template' && templateName) {
        body = {
          ...body,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            ...(text
              ? {
                  components: [
                    {
                      type: 'body',
                      parameters: [{ type: 'text', text }],
                    },
                  ],
                }
              : {}),
          },
        };
      } else if (['image', 'video', 'audio', 'document', 'media'].includes(messageType)) {
        const mediaType = ['image', 'video', 'audio', 'document'].includes(messageType) ? messageType : 'image';
        if (!mediaId && !mediaLink) {
          return { success: false, error: `Missing media link or media ID for ${mediaType}` };
        }
        body = {
          ...body,
          type: mediaType,
          [mediaType]: {
            ...(mediaLink ? { link: mediaLink } : { id: mediaId }),
            ...(text ? { caption: text } : {}),
          },
        };
      } else if (messageType === 'interactive_button' || buttons.length > 0) {
        // Meta supports max 3 reply buttons. Auto-fallback to list when options > 3.
        if (buttons.length > 3) {
          body = {
            ...body,
            type: 'interactive',
            interactive: {
              type: 'list',
              body: { text: text || 'Select an option' },
              action: {
                button: nonEmpty(input.payload?.listButtonText || 'Choose'),
                sections: [
                  {
                    title: nonEmpty(input.payload?.listSectionTitle || 'Options'),
                    rows: buttons.map((b) => ({ id: b.id, title: b.title })),
                  },
                ],
              },
            },
          };
        } else {
        body = {
          ...body,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: text || 'Please choose an option' },
            ...(nonEmpty(input.payload?.header) ? { header: { type: 'text', text: String(input.payload?.header) } } : {}),
            ...(nonEmpty(input.payload?.footer) ? { footer: { text: String(input.payload?.footer) } } : {}),
            action: {
              buttons: buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
              })),
            },
          },
        };
        }
      } else if (messageType === 'interactive_list') {
        const rowsFromJson = parseJsonArray(input.payload?.listRowsJson);
        const rows = rowsFromJson.length
          ? rowsFromJson
          : [
              {
                id: nonEmpty(input.payload?.listRow1Id || '1'),
                title: nonEmpty(input.payload?.listRow1Title || 'Item 1'),
                ...(nonEmpty(input.payload?.listRow1Description)
                  ? { description: nonEmpty(input.payload?.listRow1Description) }
                  : {}),
              },
              {
                id: nonEmpty(input.payload?.listRow2Id || ''),
                title: nonEmpty(input.payload?.listRow2Title || ''),
                ...(nonEmpty(input.payload?.listRow2Description)
                  ? { description: nonEmpty(input.payload?.listRow2Description) }
                  : {}),
              },
            ].filter((r) => nonEmpty(r.id) && nonEmpty(r.title));

        body = {
          ...body,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: text || 'Select an item' },
            action: {
              button: nonEmpty(input.payload?.listButtonText || 'Select'),
              sections: [
                {
                  title: nonEmpty(input.payload?.listSectionTitle || 'Menu'),
                  rows,
                },
              ],
            },
          },
        };
      } else if (messageType === 'product') {
        if (!catalogId || !productRetailerId) {
          return { success: false, error: 'catalogId and productRetailerId are required for product message' };
        }
        body = {
          ...body,
          type: 'product',
          product: {
            catalog_id: catalogId,
            product_retailer_id: productRetailerId,
          },
        };
      } else if (messageType === 'product_list') {
        const itemsFromJson = parseJsonArray(input.payload?.productItemsJson);
        const productItems = itemsFromJson.length
          ? itemsFromJson
          : [
              { product_retailer_id: nonEmpty(input.payload?.productItem1 || '') },
              { product_retailer_id: nonEmpty(input.payload?.productItem2 || '') },
            ].filter((p) => nonEmpty(p.product_retailer_id));
        if (!catalogId || productItems.length === 0) {
          return { success: false, error: 'catalogId and at least one product item are required for product_list' };
        }
        body = {
          ...body,
          type: 'interactive',
          interactive: {
            type: 'product_list',
            body: { text: text || 'Our products' },
            action: {
              catalog_id: catalogId,
              sections: [
                {
                  title: nonEmpty(input.payload?.productSectionTitle || 'Products'),
                  product_items: productItems,
                },
              ],
            },
          },
        };
      } else {
        body = {
          ...body,
          type: 'text',
          text: { body: text || 'Hello' },
        };
      }

      const resp = await axios.post(url, body, {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${creds.whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const messageId = String(resp.data?.messages?.[0]?.id || resp.data?.message_id || '');
      return { success: true, messageId: messageId || undefined };
    }

    if (!creds.instagramBusinessAccountId || !creds.instagramAccessToken) {
      return {
        success: false,
        error: 'Missing Instagram credentials. Set business account ID and access token.',
      };
    }

    const url = `https://graph.facebook.com/${creds.graphApiVersion}/${creds.instagramBusinessAccountId}/messages`;
    const resp = await axios.post(
      url,
      {
        recipient: { id: nonEmpty(input.recipient) },
        message: { text: nonEmpty(input.message) || 'Hello' },
      },
      {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${creds.instagramAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const messageId = String(resp.data?.message_id || resp.data?.id || '');
    return { success: true, messageId: messageId || undefined };
  } catch (error: any) {
    const msg =
      error?.response?.data?.error?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Meta send failed';
    return { success: false, error: String(msg) };
  }
}

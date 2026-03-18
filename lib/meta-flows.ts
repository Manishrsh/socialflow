import { ensureCoreSchema, sql } from '@/lib/db';

interface MetaFlowCredentials {
  wabaId: string;
  accessToken: string;
  graphApiVersion: string;
  applicationId?: string;
}

interface CreateMetaFlowInput {
  workspaceId: string;
  name: string;
  flowType?: string | null;
  endpointUri?: string | null;
  cloneFlowId?: string | null;
}

interface UpdateMetaFlowInput {
  workspaceId: string;
  flowId: string;
  name?: string | null;
  flowType?: string | null;
  endpointUri?: string | null;
}

function nonEmpty(value: any): string {
  return String(value || '').trim();
}

function categoriesForFlowType(flowType: string | null | undefined): string[] {
  switch (nonEmpty(flowType).toLowerCase()) {
    case 'appointment':
      return ['APPOINTMENT_BOOKING'];
    case 'lead_capture':
      return ['LEAD_GENERATION'];
    case 'support':
      return ['CUSTOMER_SUPPORT'];
    default:
      return ['OTHER'];
  }
}

function extractMetaError(data: any, fallback: string): string {
  return (
    data?.error?.message ||
    data?.message ||
    (Array.isArray(data?.validation_errors) && data.validation_errors.length > 0
      ? data.validation_errors
          .map((item: any) => nonEmpty(item?.message || item?.error))
          .filter(Boolean)
          .join('; ')
      : '') ||
    fallback
  );
}

async function resolveMetaFlowCredentials(workspaceId: string): Promise<MetaFlowCredentials> {
  await ensureCoreSchema();
  const rows = await sql`
    SELECT business_id, whatsapp_access_token
    FROM meta_apps
    WHERE workspace_id = ${workspaceId}
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `;

  const row = rows?.[0];
  const wabaId = nonEmpty(row?.business_id || process.env.META_WHATSAPP_WABA_ID);
  const accessToken = nonEmpty(row?.whatsapp_access_token || process.env.META_WHATSAPP_ACCESS_TOKEN);
  const graphApiVersion = nonEmpty(
    process.env.META_GRAPH_API_VERSION || process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'
  );
  const applicationId = nonEmpty(process.env.META_APP_ID);

  if (!wabaId || !accessToken) {
    throw new Error('Missing Meta WABA ID or WhatsApp access token for this workspace.');
  }

  return {
    wabaId,
    accessToken,
    graphApiVersion,
    applicationId: applicationId || undefined,
  };
}

export async function createMetaWhatsAppFlow(input: CreateMetaFlowInput): Promise<{ id: string }> {
  const creds = await resolveMetaFlowCredentials(input.workspaceId);
  const formData = new FormData();
  formData.append('name', nonEmpty(input.name) || 'Untitled Flow');
  formData.append('categories', JSON.stringify(categoriesForFlowType(input.flowType)));

  const cloneFlowId = nonEmpty(input.cloneFlowId);
  if (cloneFlowId) {
    formData.append('clone_flow_id', cloneFlowId);
  }

  const endpointUri = nonEmpty(input.endpointUri);
  if (endpointUri) {
    formData.append('endpoint_uri', endpointUri);
    if (creds.applicationId) {
      formData.append('application_id', creds.applicationId);
    }
  }

  const response = await fetch(
    `https://graph.facebook.com/${creds.graphApiVersion}/${creds.wabaId}/flows`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: formData,
      cache: 'no-store',
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractMetaError(data, 'Failed to create WhatsApp Flow in Meta.'));
  }

  const id = nonEmpty(data?.id);
  if (!id) {
    throw new Error('Meta created the Flow but did not return a flow ID.');
  }

  return { id };
}

export async function updateMetaWhatsAppFlowMetadata(input: UpdateMetaFlowInput): Promise<void> {
  const creds = await resolveMetaFlowCredentials(input.workspaceId);
  const payload: Record<string, any> = {};

  if (nonEmpty(input.name)) {
    payload.name = nonEmpty(input.name);
  }

  if (nonEmpty(input.flowType)) {
    payload.categories = categoriesForFlowType(input.flowType);
  }

  const endpointUri = nonEmpty(input.endpointUri);
  if (endpointUri) {
    payload.endpoint_uri = endpointUri;
    if (creds.applicationId) {
      payload.application_id = creds.applicationId;
    }
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${creds.graphApiVersion}/${nonEmpty(input.flowId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractMetaError(data, 'Failed to update WhatsApp Flow metadata in Meta.'));
  }
}

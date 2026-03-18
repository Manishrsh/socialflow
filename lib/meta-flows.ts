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

interface UploadMetaFlowJsonInput {
  workspaceId: string;
  flowId: string;
  flowJson: Record<string, any>;
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

function clamp(value: any, max: number): string {
  return nonEmpty(value).slice(0, max);
}

function makeOptionId(prefix: string, index: number, value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clamp(`${prefix}_${index + 1}_${normalized || 'option'}`, 200);
}

function buildDropdownOptions(values: any, prefix: string): Array<{ id: string; title: string }> {
  const items = Array.isArray(values) ? values : [];
  return items
    .map((item) => nonEmpty(item))
    .filter(Boolean)
    .slice(0, 200)
    .map((item, index) => ({
      id: makeOptionId(prefix, index, item),
      title: clamp(item, 30),
    }));
}

export function buildMetaFlowJson({
  name,
  ctaLabel,
  config,
}: {
  name: string;
  ctaLabel?: string | null;
  config?: Record<string, any>;
}): Record<string, any> {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const introText = clamp(
    safeConfig.introText || 'Please fill out this form to continue.',
    4096
  );
  const successMessage = clamp(
    safeConfig.successMessage || 'Thanks, your request has been received.',
    4096
  );
  const serviceOptions = buildDropdownOptions(safeConfig.serviceOptions, 'service');
  const timeSlots = buildDropdownOptions(safeConfig.timeSlots, 'time');

  const formChildren: any[] = [
    {
      type: 'TextHeading',
      text: clamp(name || 'Appointment Booking', 80),
    },
    {
      type: 'TextBody',
      text: introText,
    },
  ];

  if (safeConfig.askName ?? true) {
    formChildren.push({
      type: 'TextInput',
      name: 'customer_name',
      label: 'Full Name',
      'input-type': 'text',
      required: true,
    });
  }

  if (safeConfig.askPhone ?? true) {
    formChildren.push({
      type: 'TextInput',
      name: 'customer_phone',
      label: 'Phone Number',
      'input-type': 'phone',
      required: true,
    });
  }

  if ((safeConfig.askService ?? true) && serviceOptions.length > 0) {
    formChildren.push({
      type: 'Dropdown',
      name: 'service',
      label: 'Service',
      'data-source': serviceOptions,
      required: true,
    });
  }

  if (safeConfig.askDate ?? true) {
    formChildren.push({
      type: 'DatePicker',
      name: 'appointment_date',
      label: 'Preferred Date',
      required: true,
    });
  }

  if ((safeConfig.askTime ?? true) && timeSlots.length > 0) {
    formChildren.push({
      type: 'Dropdown',
      name: 'appointment_time',
      label: 'Preferred Time',
      'data-source': timeSlots,
      required: true,
    });
  }

  if (safeConfig.askNotes ?? true) {
    formChildren.push({
      type: 'TextArea',
      name: 'notes',
      label: 'Notes',
      required: false,
    });
  }

  const payload: Record<string, string> = {};
  const payloadFields = [
    'customer_name',
    'customer_phone',
    'service',
    'appointment_date',
    'appointment_time',
    'notes',
  ];

  for (const field of payloadFields) {
    if (formChildren.some((item) => item?.name === field)) {
      payload[field] = `\${form.${field}}`;
    }
  }

  formChildren.push({
    type: 'Footer',
    label: clamp(ctaLabel || 'Submit', 35),
    'on-click-action': {
      name: 'complete',
      payload,
    },
  });

  return {
    version: '7.3',
    screens: [
      {
        id: 'BOOKING_SCREEN',
        title: clamp(name || 'Booking', 30),
        terminal: true,
        success: true,
        data: {},
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form',
              children: formChildren,
            },
          ],
        },
      },
      {
        id: 'SUCCESS_SCREEN',
        title: 'Done',
        terminal: true,
        success: true,
        data: {},
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: 'Request submitted',
            },
            {
              type: 'TextBody',
              text: successMessage,
            },
            {
              type: 'Footer',
              label: 'Close',
              'on-click-action': {
                name: 'complete',
                payload,
              },
            },
          ],
        },
      },
    ],
  };
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

export async function uploadMetaWhatsAppFlowJson(input: UploadMetaFlowJsonInput): Promise<void> {
  const creds = await resolveMetaFlowCredentials(input.workspaceId);
  const formData = new FormData();
  const jsonText = JSON.stringify(input.flowJson, null, 2);
  const file = new Blob([jsonText], { type: 'application/json' });

  formData.append('file', file, 'flow.json');
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');

  const response = await fetch(
    `https://graph.facebook.com/${creds.graphApiVersion}/${nonEmpty(input.flowId)}/assets`,
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
    throw new Error(extractMetaError(data, 'Failed to upload Flow JSON to Meta.'));
  }

  if (Array.isArray(data?.validation_errors) && data.validation_errors.length > 0) {
    throw new Error(extractMetaError(data, 'Meta rejected the uploaded Flow JSON.'));
  }
}

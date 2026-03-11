export interface NodeData {
  label: string;
  [key: string]: any;
}

export interface NodeConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface NodeTemplate {
  type: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  config: NodeConfigField[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

// Node type definitions
export const NODE_TYPES = {
  // Triggers
  TRIGGER_MESSAGE: 'triggerMessage',
  TRIGGER_KEYWORD: 'triggerKeyword',
  TRIGGER_WEBHOOK: 'triggerWebhook',
  TRIGGER_SCHEDULE: 'triggerSchedule',

  // Actions
  ACTION_SEND_MESSAGE: 'actionSendMessage',
  ACTION_SEND_MEDIA: 'actionSendMedia',
  ACTION_SAVE_CONTACT: 'actionSaveContact',
  ACTION_UPDATE_CUSTOMER: 'actionUpdateCustomer',
  ACTION_ADD_TAG: 'actionAddTag',
  ACTION_CREATE_ORDER: 'actionCreateOrder',

  // Logic
  LOGIC_CONDITION: 'logicCondition',
  LOGIC_DELAY: 'logicDelay',
  LOGIC_SPLIT: 'logicSplit',
  LOGIC_LOOP: 'logicLoop',

  // Integrations
  INTEGRATION_SHEET: 'integrationSheet',
  INTEGRATION_DATABASE: 'integrationDatabase',
  INTEGRATION_WEBHOOK: 'integrationWebhook',

  // System
  SYSTEM_END: 'systemEnd',
};

export const TRIGGER_NODES = [
  {
    type: NODE_TYPES.TRIGGER_MESSAGE,
    label: 'New Message',
    description: 'Trigger when a customer sends a message',
    category: 'Triggers',
    icon: '💬',
    color: 'from-green-500 to-emerald-600',
    config: [],
  },
  {
    type: NODE_TYPES.TRIGGER_KEYWORD,
    label: 'Keyword Match',
    description: 'Trigger when message contains one of the configured keywords',
    category: 'Triggers',
    icon: '🔑',
    color: 'from-blue-500 to-cyan-600',
    config: [
      {
        key: 'keyword',
        label: 'Keyword',
        type: 'text',
        placeholder: 'Enter keyword to match',
        required: false,
      },
    ],
  },
  {
    type: NODE_TYPES.TRIGGER_WEBHOOK,
    label: 'Webhook',
    description: 'Trigger from external systems',
    category: 'Triggers',
    icon: '🪝',
    color: 'from-purple-500 to-indigo-600',
    config: [
      {
        key: 'url',
        label: 'Webhook URL',
        type: 'text',
        placeholder: 'https://example.com/webhook',
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.TRIGGER_SCHEDULE,
    label: 'Schedule',
    description: 'Trigger at a specific time or interval',
    category: 'Triggers',
    icon: '⏰',
    color: 'from-orange-500 to-red-600',
    config: [
      {
        key: 'schedule',
        label: 'Schedule',
        type: 'text',
        placeholder: 'e.g., every 5 minutes, daily at 9am',
        required: true,
      },
    ],
  },
];

export const ACTION_NODES = [
  {
    type: NODE_TYPES.ACTION_SEND_MESSAGE,
    label: 'Send Message',
    description: 'Send WhatsApp text, button, list, template, product, or read action',
    category: 'Actions',
    icon: '✉️',
    color: 'from-blue-500 to-blue-600',
    config: [
      {
        key: 'messageType',
        label: 'Message Type',
        type: 'select',
        options: ['text', 'interactive_button', 'interactive_list', 'template', 'product', 'product_list', 'read'],
        required: false,
      },
      {
        key: 'message',
        label: 'Message',
        type: 'textarea',
        placeholder: 'Enter message to send',
        required: true,
      },
      {
        key: 'header',
        label: 'Header (Optional)',
        type: 'text',
        placeholder: 'Top text for button message',
        required: false,
      },
      {
        key: 'footer',
        label: 'Footer (Optional)',
        type: 'text',
        placeholder: 'Bottom text for button message',
        required: false,
      },
      {
        key: 'button1Id',
        label: 'Button 1 ID',
        type: 'text',
        placeholder: '1',
        required: false,
      },
      {
        key: 'button1Title',
        label: 'Button 1 Text',
        type: 'text',
        placeholder: 'Interested',
        required: false,
      },
      {
        key: 'button2Id',
        label: 'Button 2 ID',
        type: 'text',
        placeholder: '2',
        required: false,
      },
      {
        key: 'button2Title',
        label: 'Button 2 Text',
        type: 'text',
        placeholder: 'Talk to Agent',
        required: false,
      },
      {
        key: 'templateName',
        label: 'Template Name (Optional)',
        type: 'text',
        placeholder: 'e.g. demo_template',
        required: false,
      },
      {
        key: 'templateLanguage',
        label: 'Template Language',
        type: 'text',
        placeholder: 'en_US',
        required: false,
      },
    ],
  },
  {
    type: NODE_TYPES.ACTION_SEND_MEDIA,
    label: 'Send Media',
    description: 'Send images/videos/documents by URL or Meta media ID',
    category: 'Actions',
    icon: '📸',
    color: 'from-pink-500 to-rose-600',
    config: [
      {
        key: 'mediaType',
        label: 'Media Type',
        type: 'select',
        options: ['image', 'video', 'document'],
        required: true,
      },
      {
        key: 'mediaUrl',
        label: 'Media URL',
        type: 'text',
        placeholder: 'Enter media URL or file path',
        required: true,
      },
      {
        key: 'mediaId',
        label: 'Meta Media ID',
        type: 'text',
        placeholder: 'Optional existing media ID',
        required: false,
      },
      {
        key: 'caption',
        label: 'Caption',
        type: 'text',
        placeholder: 'Optional caption',
        required: false,
      },
    ],
  },
  {
    type: NODE_TYPES.ACTION_SAVE_CONTACT,
    label: 'Save Contact',
    description: 'Save customer info to CRM',
    category: 'Actions',
    icon: '👤',
    color: 'from-teal-500 to-cyan-600',
    config: [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        placeholder: 'Customer name',
        required: true,
      },
      {
        key: 'phone',
        label: 'Phone',
        type: 'text',
        placeholder: 'Phone number',
        required: true,
      },
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        placeholder: 'Email address',
        required: false,
      },
    ],
  },
  {
    type: NODE_TYPES.ACTION_UPDATE_CUSTOMER,
    label: 'Update Customer',
    description: 'Update customer profile',
    category: 'Actions',
    icon: '🔄',
    color: 'from-violet-500 to-purple-600',
    config: [
      {
        key: 'customerId',
        label: 'Customer ID',
        type: 'text',
        placeholder: 'Customer ID to update',
        required: true,
      },
      {
        key: 'field',
        label: 'Field to Update',
        type: 'text',
        placeholder: 'Field name',
        required: true,
      },
      {
        key: 'value',
        label: 'New Value',
        type: 'text',
        placeholder: 'New value',
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.ACTION_ADD_TAG,
    label: 'Add Tag',
    description: 'Add tags to customer',
    category: 'Actions',
    icon: '🏷️',
    color: 'from-yellow-500 to-amber-600',
    config: [
      {
        key: 'customerId',
        label: 'Customer ID',
        type: 'text',
        placeholder: 'Customer ID',
        required: true,
      },
      {
        key: 'tags',
        label: 'Tags',
        type: 'text',
        placeholder: 'Comma-separated tags',
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.ACTION_CREATE_ORDER,
    label: 'Create Order',
    description: 'Create a new customer order',
    category: 'Actions',
    icon: '🛒',
    color: 'from-green-500 to-emerald-600',
    config: [
      {
        key: 'customerId',
        label: 'Customer ID',
        type: 'text',
        placeholder: 'Customer ID',
        required: true,
      },
      {
        key: 'product',
        label: 'Product',
        type: 'text',
        placeholder: 'Product name',
        required: true,
      },
      {
        key: 'quantity',
        label: 'Quantity',
        type: 'number',
        placeholder: '1',
        required: true,
      },
    ],
  },
];

export const LOGIC_NODES = [
  {
    type: NODE_TYPES.LOGIC_CONDITION,
    label: 'Condition',
    description: 'Split flow based on conditions',
    category: 'Logic',
    icon: '⚔️',
    color: 'from-red-500 to-orange-600',
    config: [
      {
        key: 'condition',
        label: 'Condition',
        type: 'text',
        placeholder: 'e.g., message.contains("hello")',
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.LOGIC_DELAY,
    label: 'Delay',
    description: 'Wait for specified duration',
    category: 'Logic',
    icon: '⏳',
    color: 'from-gray-500 to-slate-600',
    config: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'text',
        placeholder: 'e.g., 5 seconds, 1 minute',
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.LOGIC_SPLIT,
    label: 'Split',
    description: 'Split into multiple paths',
    category: 'Logic',
    icon: '🔀',
    color: 'from-indigo-500 to-blue-600',
    config: [
      {
        key: 'paths',
        label: 'Number of Paths',
        type: 'number',
        placeholder: '2',
        required: true,
      },
    ],
  },
];

export const INTEGRATION_NODES = [
  {
    type: NODE_TYPES.INTEGRATION_SHEET,
    label: 'Google Sheets',
    description: 'Read/write to Google Sheets',
    category: 'Integrations',
    icon: '📊',
    color: 'from-green-500 to-teal-600',
    config: [
      {
        key: 'sheetId',
        label: 'Sheet ID',
        type: 'text',
        placeholder: 'Google Sheet ID',
        required: true,
      },
      {
        key: 'action',
        label: 'Action',
        type: 'select',
        options: ['read', 'write', 'append'],
        required: true,
      },
    ],
  },
  {
    type: NODE_TYPES.INTEGRATION_DATABASE,
    label: 'Database',
    description: 'Query or update database',
    category: 'Integrations',
    icon: '🗄️',
    color: 'from-slate-500 to-gray-600',
    config: [
      {
        key: 'query',
        label: 'SQL Query',
        type: 'textarea',
        placeholder: 'SELECT * FROM table',
        required: true,
      },
    ],
  },
];

export const SYSTEM_NODES = [
  {
    type: NODE_TYPES.SYSTEM_END,
    label: 'End',
    description: 'End workflow execution',
    category: 'System',
    icon: '🏁',
    color: 'from-gray-500 to-gray-600',
    config: [],
  },
];

export const ALL_NODE_TEMPLATES = [
  ...TRIGGER_NODES,
  ...ACTION_NODES,
  ...LOGIC_NODES,
  ...INTEGRATION_NODES,
  ...SYSTEM_NODES,
];

export function getNodeTemplate(type: string): NodeTemplate | undefined {
  return ALL_NODE_TEMPLATES.find((t) => t.type === type);
}

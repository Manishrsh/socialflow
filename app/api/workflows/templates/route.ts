import { NextRequest, NextResponse } from 'next/server';

const WORKFLOW_TEMPLATES = [
  {
    id: 'welcome-sequence',
    name: 'Welcome Sequence',
    description: 'Automatically welcome new customers and send product catalog',
    nodes: [
      {
        id: 'trigger-1',
        type: 'triggerMessage',
        position: { x: 100, y: 100 },
        data: { label: 'New Customer' },
      },
      {
        id: 'delay-1',
        type: 'logicDelay',
        position: { x: 300, y: 100 },
        data: { label: 'Wait 5 seconds', duration: '5s' },
      },
      {
        id: 'send-1',
        type: 'actionSendMessage',
        position: { x: 500, y: 100 },
        data: { label: 'Send Welcome', message: 'Welcome to our jewelry store!' },
      },
      {
        id: 'send-2',
        type: 'actionSendMedia',
        position: { x: 700, y: 100 },
        data: { label: 'Send Catalog' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'delay-1' },
      { id: 'e2', source: 'delay-1', target: 'send-1' },
      { id: 'e3', source: 'send-1', target: 'send-2' },
    ],
  },
  {
    id: 'order-confirmation',
    name: 'Order Confirmation',
    description: 'Send order confirmation and tracking updates',
    nodes: [
      {
        id: 'trigger-1',
        type: 'triggerWebhook',
        position: { x: 100, y: 100 },
        data: { label: 'Order Placed' },
      },
      {
        id: 'save-1',
        type: 'actionSaveContact',
        position: { x: 300, y: 100 },
        data: { label: 'Save Order Info' },
      },
      {
        id: 'send-1',
        type: 'actionSendMessage',
        position: { x: 500, y: 100 },
        data: { label: 'Send Confirmation', message: 'Your order has been confirmed!' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'save-1' },
      { id: 'e2', source: 'save-1', target: 'send-1' },
    ],
  },
  {
    id: 'price-enquiry',
    name: 'Price Enquiry Handler',
    description: 'Automatically respond to price enquiries',
    nodes: [
      {
        id: 'trigger-1',
        type: 'triggerKeyword',
        position: { x: 100, y: 100 },
        data: { label: 'Message contains "price"' },
      },
      {
        id: 'condition-1',
        type: 'logicCondition',
        position: { x: 300, y: 100 },
        data: { label: 'Check product' },
      },
      {
        id: 'send-1',
        type: 'actionSendMessage',
        position: { x: 500, y: 50 },
        data: { label: 'Send Price' },
      },
      {
        id: 'send-2',
        type: 'actionSendMedia',
        position: { x: 500, y: 150 },
        data: { label: 'Send Details' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'condition-1' },
      { id: 'e2', source: 'condition-1', target: 'send-1' },
      { id: 'e3', source: 'condition-1', target: 'send-2' },
    ],
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring',
    description: 'Score and tag leads based on engagement',
    nodes: [
      {
        id: 'trigger-1',
        type: 'triggerMessage',
        position: { x: 100, y: 100 },
        data: { label: 'Customer Message' },
      },
      {
        id: 'condition-1',
        type: 'logicCondition',
        position: { x: 300, y: 100 },
        data: { label: 'Check message sentiment' },
      },
      {
        id: 'tag-1',
        type: 'actionAddTag',
        position: { x: 500, y: 50 },
        data: { label: 'Hot Lead' },
      },
      {
        id: 'tag-2',
        type: 'actionAddTag',
        position: { x: 500, y: 150 },
        data: { label: 'Warm Lead' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'condition-1' },
      { id: 'e2', source: 'condition-1', target: 'tag-1' },
      { id: 'e3', source: 'condition-1', target: 'tag-2' },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json(template);
    }

    return NextResponse.json({
      templates: WORKFLOW_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
    });
  } catch (error) {
    console.error('Template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

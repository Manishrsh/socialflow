'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { getNodeTemplate, NodeConfigField } from '@/lib/workflow-nodes';
import { X } from 'lucide-react';

interface WorkflowNodeProps {
  id: string;
  data: {
    label: string;
    onDelete?: (id: string) => void;
    [key: string]: any;
  };
  selected?: boolean;
  type?: string;
}

function normalizeNodeButtons(data: Record<string, any>): Array<{ id: string; title: string }> {
  const fromArray = Array.isArray(data?.buttons)
    ? data.buttons
        .map((b: any, idx: number) => ({
          id: String(b?.id || idx + 1).trim(),
          title: String(b?.title || `Option ${idx + 1}`).trim(),
        }))
        .filter((b) => b.id && b.title)
    : [];

  if (fromArray.length > 0) return fromArray;

  const fallback = [
    data?.button1Title
      ? { id: String(data?.button1Id || '1').trim(), title: String(data?.button1Title).trim() }
      : null,
    data?.button2Title
      ? { id: String(data?.button2Id || '2').trim(), title: String(data?.button2Title).trim() }
      : null,
  ].filter(Boolean) as Array<{ id: string; title: string }>;

  return fallback.filter((b) => b.id && b.title);
}

function normalizeKeywords(data: Record<string, any>): string[] {
  const fromArray = Array.isArray(data?.keywords)
    ? data.keywords
        .map((item: any) => String(item || '').trim())
        .filter(Boolean)
    : [];

  if (fromArray.length > 0) return fromArray;

  const singleKeyword = String(data?.keyword || '').trim();
  return singleKeyword ? [singleKeyword] : [];
}

function normalizeMediaItems(data: Record<string, any>): Array<{ mediaUrl: string; caption: string }> {
  const fromArray = Array.isArray(data?.mediaItems)
    ? data.mediaItems
        .map((item: any) => ({
          mediaUrl: String(item?.mediaUrl || '').trim(),
          caption: String(item?.caption || '').trim(),
        }))
        .filter((item) => item.mediaUrl || item.caption)
    : [];

  if (fromArray.length > 0) return fromArray;

  const singleUrl = String(data?.mediaUrl || '').trim();
  if (!singleUrl) return [];
  return [{ mediaUrl: singleUrl, caption: String(data?.caption || '').trim() }];
}

export function CustomNode({
  id,
  data,
  selected,
  type,
}: WorkflowNodeProps) {
  const template = type ? getNodeTemplate(type) : null;
  const onDelete = data.onDelete;
  const messageType = String(data?.messageType || '').trim().toLowerCase();
  const keywordList = type === 'triggerKeyword' ? normalizeKeywords(data) : [];
  const mediaItems = type === 'actionSendMedia' ? normalizeMediaItems(data) : [];
  const buttonOptions =
    type === 'actionSendMessage' &&
    (messageType === 'interactive_button' || messageType === '' || messageType === 'interactive_list')
      ? normalizeNodeButtons(data)
      : [];

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg border-2 min-w-48 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-card'
      }`}
    >
      <Handle type="target" position={Position.Top} />

      <div className="space-y-2">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xl mb-1">{template?.icon || '◯'}</div>
            <div className="font-semibold text-sm">{data.label}</div>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="text-foreground/40 hover:text-foreground/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Node configuration */}
        {type && (
          <div className="text-xs text-foreground/60 space-y-1 mt-2">
            {type === 'actionSendMessage' && buttonOptions.length > 0 && (
              <div>
                Options: {buttonOptions.length}
              </div>
            )}
            {type === 'actionSendMedia' && mediaItems.length > 0 && (
              <div>
                Media items: {mediaItems.length}
              </div>
            )}
            {type === 'triggerKeyword' && keywordList.length > 0 && (
              <div>
                Keywords: {keywordList.join(', ')}
              </div>
            )}
            {template?.config?.map((field: NodeConfigField) => {
              const value = data[field.key];
              return value ? (
                <div key={field.key}>
                  {field.label}: {value}
                </div>
              ) : null;
            })}
            {(!template?.config || template.config.length === 0 || 
              !template.config.some((field: NodeConfigField) => data[field.key])) && (
              <div>No configuration set</div>
            )}
          </div>
        )}
      </div>

      {buttonOptions.map((btn, idx) => (
        <Handle
          key={`btn-handle-${btn.id}-${idx}`}
          id={`btn:${btn.id}`}
          type="source"
          position={Position.Right}
          style={{
            top: 72 + idx * 26,
            width: 12,
            height: 12,
            borderRadius: 9999,
            background: '#16a34a',
          }}
        />
      ))}

      <Handle type="source" id="default" position={Position.Bottom} />
    </div>
  );
}

export function TriggerNode(props: WorkflowNodeProps) {
  return <CustomNode {...props} />;
}

export function ActionNode(props: WorkflowNodeProps) {
  return <CustomNode {...props} />;
}

export function LogicNode(props: WorkflowNodeProps) {
  return <CustomNode {...props} />;
}

export function IntegrationNode(props: WorkflowNodeProps) {
  return <CustomNode {...props} />;
}

export function SystemNode(props: WorkflowNodeProps) {
  return <CustomNode {...props} />;
}

export const nodeTypes = {
  triggerMessage: TriggerNode,
  triggerKeyword: TriggerNode,
  triggerWebhook: TriggerNode,
  triggerSchedule: TriggerNode,
  actionSendMessage: ActionNode,
  actionSendMedia: ActionNode,
  actionSaveContact: ActionNode,
  actionUpdateCustomer: ActionNode,
  actionAddTag: ActionNode,
  actionCreateOrder: ActionNode,
  logicCondition: LogicNode,
  logicDelay: LogicNode,
  logicSplit: LogicNode,
  logicLoop: LogicNode,
  integrationSheet: IntegrationNode,
  integrationDatabase: IntegrationNode,
  integrationWebhook: IntegrationNode,
  systemEnd: SystemNode,
};

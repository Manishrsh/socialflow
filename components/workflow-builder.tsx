'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  NodeMouseHandler,
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './workflow-nodes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  TRIGGER_NODES, 
  ACTION_NODES, 
  LOGIC_NODES, 
  INTEGRATION_NODES,
  SYSTEM_NODES,
  ALL_NODE_TEMPLATES,
  getNodeTemplate,
  NodeConfigField,
} from '@/lib/workflow-nodes';
import { v4 as uuidv4 } from 'uuid';
import { ChevronDown, ChevronUp, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface WorkflowBuilderProps {
  workflowId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialName?: string;
  initialDescription?: string;
  onSave?: (payload: {
    name: string;
    description: string;
    nodes: Node[];
    edges: Edge[];
  }) => Promise<void>;
}

interface MediaLibraryItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
}

function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          onClick={() => data?.onDelete?.(id)}
          aria-label="Delete connection"
          title="Unlink"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

function WorkflowBuilderContent({
  workflowId,
  initialNodes = [],
  initialEdges = [],
  initialName = 'Untitled Workflow',
  initialDescription = '',
  onSave,
}: WorkflowBuilderProps) {
  const { workspace } = useAuth();
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodesChange = useCallback((changes: any[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);
  const [workflowName, setWorkflowName] = useState(initialName);
  const [workflowDescription, setWorkflowDescription] = useState(initialDescription);
  const [expandedSections, setExpandedSections] = useState({
    triggers: true,
    actions: true,
    logic: false,
    integrations: false,
    system: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkSourceNodeId, setLinkSourceNodeId] = useState<string | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryItem[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const edgeTypes = {
    deletable: DeletableEdge,
  };

  useEffect(() => {
    setWorkflowName(initialName);
  }, [initialName]);

  useEffect(() => {
    setWorkflowDescription(initialDescription);
  }, [initialDescription]);

  useEffect(() => {
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode || selectedNode.type !== 'actionSendMedia' || !workspace?.id) {
      return;
    }

    let cancelled = false;
    setIsMediaLoading(true);
    fetch(`/api/media/list?workspaceId=${workspace.id}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setMediaLibrary(Array.isArray(data?.media) ? data.media : []);
      })
      .catch(() => {
        if (cancelled) return;
        setMediaLibrary([]);
      })
      .finally(() => {
        if (!cancelled) setIsMediaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId, nodes, workspace?.id]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const updateNodeData = (nodeId: string, key: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, [key]: value } }
          : node
      )
    );
  };

  const updateMessageButtons = (nodeId: string, buttons: Array<{ id: string; title: string }>) => {
    updateNodeData(nodeId, 'buttons', buttons);
  };

  const getNormalizedMessageButtons = (nodeId: string) => {
    const selectedNode = nodes.find((n) => n.id === nodeId);
    const arrayButtons = Array.isArray(selectedNode?.data?.buttons) ? selectedNode.data.buttons : [];

    if (arrayButtons.length > 0) {
      return arrayButtons;
    }

    const legacyButtons = [
      selectedNode?.data?.button1Title
        ? {
            id: String(selectedNode?.data?.button1Id || '1'),
            title: String(selectedNode.data.button1Title),
          }
        : null,
      selectedNode?.data?.button2Title
        ? {
            id: String(selectedNode?.data?.button2Id || '2'),
            title: String(selectedNode.data.button2Title),
          }
        : null,
    ].filter((button): button is { id: string; title: string } => Boolean(button));

    return legacyButtons;
  };

  const addMessageButton = (nodeId: string) => {
    const existing = getNormalizedMessageButtons(nodeId);
    if (existing.length >= 10) return;
    const nextIndex = existing.length + 1;
    const next = [...existing, { id: String(nextIndex), title: `Option ${nextIndex}` }];
    updateMessageButtons(nodeId, next);
    const selectedNode = nodes.find((n) => n.id === nodeId);
    if (!Array.isArray(selectedNode?.data?.buttons) || selectedNode.data.buttons.length === 0) {
      // Clear legacy 2-button fields once they have been migrated to dynamic options mode.
      updateNodeData(nodeId, 'button1Id', '');
      updateNodeData(nodeId, 'button1Title', '');
      updateNodeData(nodeId, 'button2Id', '');
      updateNodeData(nodeId, 'button2Title', '');
    }
  };

  const removeMessageButton = (nodeId: string, index: number) => {
    const existing = getNormalizedMessageButtons(nodeId);
    const next = existing.filter((_: any, i: number) => i !== index);
    updateMessageButtons(nodeId, next);
  };

  const updateMessageButtonField = (nodeId: string, index: number, key: 'id' | 'title', value: string) => {
    const existing = getNormalizedMessageButtons(nodeId);
    const next = existing.map((b: any, i: number) => (i === index ? { ...b, [key]: value } : b));
    updateMessageButtons(nodeId, next);
  };

  const getKeywordList = (nodeId: string): string[] => {
    const selectedNode = nodes.find((n) => n.id === nodeId);
    const keywords = Array.isArray(selectedNode?.data?.keywords)
      ? selectedNode.data.keywords
      : [];
    if (keywords.length > 0) {
      return keywords.map((item: any) => String(item || ''));
    }
    const singleKeyword = String(selectedNode?.data?.keyword || '').trim();
    return singleKeyword ? [singleKeyword] : [];
  };

  const updateKeywordList = (nodeId: string, keywords: string[]) => {
    updateNodeData(nodeId, 'keywords', keywords);
    updateNodeData(nodeId, 'keyword', keywords[0] || '');
  };

  const addKeyword = (nodeId: string) => {
    const keywords = getKeywordList(nodeId);
    updateKeywordList(nodeId, [...keywords, '']);
  };

  const updateKeyword = (nodeId: string, index: number, value: string) => {
    const keywords = getKeywordList(nodeId);
    const next = keywords.map((item, itemIndex) => (itemIndex === index ? value : item));
    updateKeywordList(nodeId, next);
  };

  const removeKeyword = (nodeId: string, index: number) => {
    const keywords = getKeywordList(nodeId);
    updateKeywordList(nodeId, keywords.filter((_, itemIndex) => itemIndex !== index));
  };

  const getMediaItems = (nodeId: string) => {
    const selectedNode = nodes.find((n) => n.id === nodeId);
    const mediaItems = Array.isArray(selectedNode?.data?.mediaItems)
      ? selectedNode.data.mediaItems
      : [];

    if (mediaItems.length > 0) {
      return mediaItems.map((item: any, index: number) => ({
        mediaType: String(item?.mediaType || selectedNode?.data?.mediaType || 'image'),
        mediaUrl: String(item?.mediaUrl || ''),
        caption: String(item?.caption || ''),
        metaMediaId: String(item?.metaMediaId || ''),
        sortOrder: Number(item?.sortOrder ?? index),
      }));
    }

    const legacyUrl = String(selectedNode?.data?.mediaUrl || '').trim();
    const legacyMediaId = String(selectedNode?.data?.metaMediaId || '').trim();
    if (!legacyUrl && !legacyMediaId) return [];

    return [
      {
        mediaType: String(selectedNode?.data?.mediaType || 'image'),
        mediaUrl: legacyUrl,
        caption: String(selectedNode?.data?.caption || ''),
        metaMediaId: legacyMediaId,
        sortOrder: 0,
      },
    ];
  };

  const updateMediaItems = (nodeId: string, mediaItems: Array<Record<string, any>>) => {
    updateNodeData(nodeId, 'mediaItems', mediaItems);
  };

  const addMediaItem = (nodeId: string) => {
    const items = getMediaItems(nodeId);
    updateMediaItems(nodeId, [
      ...items,
      {
        mediaType: 'image',
        mediaUrl: '',
        caption: '',
        metaMediaId: '',
        sortOrder: items.length,
      },
    ]);
  };

  const updateMediaItem = (
    nodeId: string,
    index: number,
    key: 'mediaType' | 'mediaUrl' | 'caption' | 'metaMediaId',
    value: string
  ) => {
    const items = getMediaItems(nodeId);
    updateMediaItems(
      nodeId,
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value, sortOrder: itemIndex } : item
      )
    );
  };

  const removeMediaItem = (nodeId: string, index: number) => {
    const items = getMediaItems(nodeId);
    updateMediaItems(
      nodeId,
      items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))
    );
  };

  const addNode = (template: any) => {
    const newNode: Node = {
      id: uuidv4(),
      data: { label: template.label },
      position: {
        x: Math.random() * 500,
        y: Math.random() * 300,
      },
      type: template.type,
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  };

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (linkSourceNodeId && linkSourceNodeId !== node.id) {
      const edgeExists = edges.some(
        (e) => e.source === linkSourceNodeId && e.target === node.id
      );
      if (!edgeExists) {
        setEdges((eds) => [
          ...eds,
          {
            id: `${linkSourceNodeId}-${node.id}-${Date.now()}`,
            source: linkSourceNodeId,
            target: node.id,
            animated: true,
            type: 'deletable',
          },
        ]);
      }
      setLinkSourceNodeId(null);
      setSelectedNodeId(node.id);
      return;
    }

    setSelectedNodeId(node.id);
  }, [linkSourceNodeId, edges, setEdges]);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave({
        name: workflowName,
        description: workflowDescription,
        nodes,
        edges,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderNodeCategory = (
    category: string,
    templates: any[],
    section: keyof typeof expandedSections
  ) => (
    <div className="space-y-2">
      <button
        onClick={() => toggleSection(section)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-semibold"
      >
        <span>{category}</span>
        {expandedSections[section] ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {expandedSections[section] && (
        <div className="space-y-2 pl-2">
          {templates.map((template) => (
            <button
              key={template.type}
              onClick={() => addNode(template)}
              className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm group"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{template.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-xs">{template.label}</div>
                  <div className="text-xs text-foreground/50">{template.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Node Panel */}
      <div className="w-80 border-r border-border bg-card overflow-y-auto">
        <div className="p-4 space-y-6 sticky top-0 bg-card border-b border-border">
          <div>
            <label className="block text-sm font-medium mb-2">Workflow Name</label>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Input
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {renderNodeCategory('Triggers', TRIGGER_NODES, 'triggers')}
          {renderNodeCategory('Actions', ACTION_NODES, 'actions')}
          {renderNodeCategory('Logic', LOGIC_NODES, 'logic')}
          {renderNodeCategory('Integrations', INTEGRATION_NODES, 'integrations')}
          {renderNodeCategory('System', SYSTEM_NODES, 'system')}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold">{workflowName}</h2>
          <div className="text-xs text-foreground/60">
            Nodes: {nodes.length} | Connections: {edges.length}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes.map((node) => ({
              ...node,
              data: {
                ...node.data,
                onDelete: deleteNode,
              },
            }))}
            edges={edges.map((edge) => ({
              ...edge,
              type: edge.type || 'deletable',
              data: {
                ...edge.data,
                onDelete: deleteEdge,
              },
            }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setReactFlowInstance}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Configuration Panel */}
      {selectedNodeId && (
        <div className="w-80 border-l border-border bg-card overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Node Configuration</h3>
          </div>
          <div className="p-4">
            {(() => {
              const selectedNode = nodes.find(n => n.id === selectedNodeId);
              const template = selectedNode?.type ? getNodeTemplate(selectedNode.type) : null;
              
              if (!template || !template.config || template.config.length === 0) {
                return (
                  <div className="space-y-3">
                    <div className="text-sm text-foreground/60">
                      No configuration required for this node.
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-2 border rounded-lg text-xs ${
                          linkSourceNodeId === selectedNodeId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                        onClick={() => setLinkSourceNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId))}
                      >
                        {linkSourceNodeId === selectedNodeId ? 'Cancel Link Mode' : 'Link From This Node'}
                      </button>
                    </div>
                    {linkSourceNodeId === selectedNodeId ? (
                      <div className="text-xs text-foreground/60">
                        Click any other node on canvas to create connection.
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (selectedNode?.type === 'actionSendMessage') {
                const currentType = selectedNode?.data.messageType || '';
                const targetNodeOptions = nodes
                  .filter((n) => n.id !== selectedNodeId)
                  .map((n) => ({ id: n.id, label: String(n.data?.label || n.type || n.id) }));
                const buttonRoutes =
                  selectedNode?.data?.buttonRoutes && typeof selectedNode?.data?.buttonRoutes === 'object'
                    ? selectedNode?.data?.buttonRoutes
                    : {};
                return (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-2 border rounded-lg text-xs ${
                          linkSourceNodeId === selectedNodeId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                        onClick={() => setLinkSourceNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId))}
                      >
                        {linkSourceNodeId === selectedNodeId ? 'Cancel Link Mode' : 'Link From This Node'}
                      </button>
                    </div>
                    {linkSourceNodeId === selectedNodeId ? (
                      <div className="text-xs text-foreground/60">
                        Click a target node on canvas to draw link.
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-sm font-medium mb-2">Message Type</label>
                      <select
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        value={currentType}
                        onChange={(e) => updateNodeData(selectedNodeId, 'messageType', e.target.value)}
                      >
                        <option value="">Text</option>
                        <option value="interactive_button">Button Message</option>
                        <option value="interactive_list">List Message</option>
                        <option value="template">Template Message</option>
                        <option value="product">Product Message</option>
                        <option value="product_list">Multi Product Message</option>
                        <option value="read">Mark Message As Read</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Message</label>
                      <textarea
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        placeholder="Type message text"
                        value={selectedNode?.data.message || ''}
                        onChange={(e) => updateNodeData(selectedNodeId, 'message', e.target.value)}
                        rows={4}
                      />
                    </div>

                    {(currentType === 'interactive_button' || currentType === '') && (
                      <>
                        <div className="text-xs text-foreground/60">
                          Tip: Drag from green dot on each button in node card to connect that button to next node.
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Header (Optional)</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Top text"
                            value={selectedNode?.data.header || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'header', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Footer (Optional)</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Bottom text"
                            value={selectedNode?.data.footer || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'footer', e.target.value)}
                          />
                        </div>

                        <div className="border rounded-lg p-3 space-y-3">
                          <div className="text-sm font-medium">Buttons</div>
                          {Array.isArray(selectedNode?.data.buttons) &&
                          selectedNode.data.buttons.length > 0 ? (
                            <div className="space-y-2">
                              {selectedNode.data.buttons.map((btn: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                  <input
                                    type="text"
                                    className="col-span-3 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                    placeholder={`ID ${idx + 1}`}
                                    value={btn?.id || ''}
                                    onChange={(e) =>
                                      updateMessageButtonField(selectedNodeId, idx, 'id', e.target.value)
                                    }
                                  />
                                  <input
                                    type="text"
                                    className="col-span-7 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                    placeholder={`Button text ${idx + 1}`}
                                    value={btn?.title || ''}
                                    onChange={(e) =>
                                      updateMessageButtonField(selectedNodeId, idx, 'title', e.target.value)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="col-span-2 px-2 py-2 border border-border rounded-lg text-xs hover:bg-muted"
                                    onClick={() => removeMessageButton(selectedNodeId, idx)}
                                  >
                                    Remove
                                  </button>
                                  <select
                                    className="col-span-12 w-full px-3 py-2 border border-border rounded-lg bg-background text-xs"
                                    value={buttonRoutes[String(btn?.id || '')] || ''}
                                    onChange={(e) => {
                                      const routeKey = String(btn?.id || '');
                                      const nextRoutes = { ...buttonRoutes, [routeKey]: e.target.value || null };
                                      updateNodeData(selectedNodeId, 'buttonRoutes', nextRoutes);
                                    }}
                                  >
                                    <option value="">Next node for this option (optional)</option>
                                    {targetNodeOptions.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                placeholder="Button 1 ID"
                                value={selectedNode?.data.button1Id || ''}
                                onChange={(e) => updateNodeData(selectedNodeId, 'button1Id', e.target.value)}
                              />
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                placeholder="Button 1 Text"
                                value={selectedNode?.data.button1Title || ''}
                                onChange={(e) => updateNodeData(selectedNodeId, 'button1Title', e.target.value)}
                              />
                              <select
                                className="col-span-2 w-full px-3 py-2 border border-border rounded-lg bg-background text-xs"
                                value={buttonRoutes[String(selectedNode?.data.button1Id || '1')] || ''}
                                onChange={(e) => {
                                  const routeKey = String(selectedNode?.data.button1Id || '1');
                                  const nextRoutes = { ...buttonRoutes, [routeKey]: e.target.value || null };
                                  updateNodeData(selectedNodeId, 'buttonRoutes', nextRoutes);
                                }}
                              >
                                <option value="">Next node for button 1 (optional)</option>
                                {targetNodeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                placeholder="Button 2 ID"
                                value={selectedNode?.data.button2Id || ''}
                                onChange={(e) => updateNodeData(selectedNodeId, 'button2Id', e.target.value)}
                              />
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                                placeholder="Button 2 Text"
                                value={selectedNode?.data.button2Title || ''}
                                onChange={(e) => updateNodeData(selectedNodeId, 'button2Title', e.target.value)}
                              />
                              <select
                                className="col-span-2 w-full px-3 py-2 border border-border rounded-lg bg-background text-xs"
                                value={buttonRoutes[String(selectedNode?.data.button2Id || '2')] || ''}
                                onChange={(e) => {
                                  const routeKey = String(selectedNode?.data.button2Id || '2');
                                  const nextRoutes = { ...buttonRoutes, [routeKey]: e.target.value || null };
                                  updateNodeData(selectedNodeId, 'buttonRoutes', nextRoutes);
                                }}
                              >
                                <option value="">Next node for button 2 (optional)</option>
                                {targetNodeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-foreground/60">
                              Up to 10 options. More than 3 auto-sends as list. You can map each option to next node.
                            </div>
                            <button
                              type="button"
                              className="px-3 py-1 border border-border rounded-lg text-xs hover:bg-muted"
                              onClick={() => addMessageButton(selectedNodeId)}
                            >
                              Add Option
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {currentType === 'interactive_list' && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">List Configuration</div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Button text (e.g. Products)"
                          value={selectedNode?.data.listButtonText || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'listButtonText', e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Section title (e.g. Menu)"
                          value={selectedNode?.data.listSectionTitle || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'listSectionTitle', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Row 1 ID"
                            value={selectedNode?.data.listRow1Id || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'listRow1Id', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Row 1 Title"
                            value={selectedNode?.data.listRow1Title || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'listRow1Title', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Row 2 ID"
                            value={selectedNode?.data.listRow2Id || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'listRow2Id', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Row 2 Title"
                            value={selectedNode?.data.listRow2Title || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'listRow2Title', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {currentType === 'template' && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Template</div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Template name (e.g. hello_world)"
                          value={selectedNode?.data.templateName || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'templateName', e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Template language (en_US)"
                          value={selectedNode?.data.templateLanguage || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'templateLanguage', e.target.value)}
                        />
                      </div>
                    )}

                    {currentType === 'product' && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Product Message</div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Catalog ID"
                          value={selectedNode?.data.catalogId || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'catalogId', e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Product Retailer ID"
                          value={selectedNode?.data.productRetailerId || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'productRetailerId', e.target.value)}
                        />
                      </div>
                    )}

                    {currentType === 'product_list' && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Multi Product Message</div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Catalog ID"
                          value={selectedNode?.data.catalogId || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'catalogId', e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Section title (e.g. Featured)"
                          value={selectedNode?.data.productSectionTitle || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'productSectionTitle', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Product item 1"
                            value={selectedNode?.data.productItem1 || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'productItem1', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            placeholder="Product item 2"
                            value={selectedNode?.data.productItem2 || ''}
                            onChange={(e) => updateNodeData(selectedNodeId, 'productItem2', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {currentType === 'read' && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Mark As Read</div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Message ID to mark as read"
                          value={selectedNode?.data.messageIdToRead || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, 'messageIdToRead', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              if (selectedNode?.type === 'actionSendMedia') {
                const mediaItems = getMediaItems(selectedNodeId);
                return (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-2 border rounded-lg text-xs ${
                          linkSourceNodeId === selectedNodeId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                        onClick={() => setLinkSourceNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId))}
                      >
                        {linkSourceNodeId === selectedNodeId ? 'Cancel Link Mode' : 'Link From This Node'}
                      </button>
                    </div>
                    {linkSourceNodeId === selectedNodeId ? (
                      <div className="text-xs text-foreground/60">
                        Click a target node on canvas to draw link.
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-sm font-medium mb-2">Media From Library</label>
                      <select
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        value={selectedNode?.data.mediaId || ''}
                        onChange={(e) => {
                          const mediaId = e.target.value;
                          const media = mediaLibrary.find((m) => m.id === mediaId);
                          updateNodeData(selectedNodeId, 'mediaId', mediaId);
                          if (media?.url) updateNodeData(selectedNodeId, 'mediaUrl', media.url);
                          if (media?.file_type?.startsWith('image/')) {
                            updateNodeData(selectedNodeId, 'mediaType', 'image');
                          } else if (media?.file_type?.startsWith('video/')) {
                            updateNodeData(selectedNodeId, 'mediaType', 'video');
                          } else if (media) {
                            updateNodeData(selectedNodeId, 'mediaType', 'document');
                          }
                          if (media) {
                            const nextType = media?.file_type?.startsWith('image/')
                              ? 'image'
                              : media?.file_type?.startsWith('video/')
                                ? 'video'
                                : 'document';
                            updateMediaItems(selectedNodeId, [
                              ...mediaItems,
                              {
                                mediaType: nextType,
                                mediaUrl: media.url || '',
                                caption: '',
                                metaMediaId: '',
                                sortOrder: mediaItems.length,
                              },
                            ]);
                          }
                        }}
                      >
                        <option value="">
                          {isMediaLoading ? 'Loading media...' : 'Select media from library'}
                        </option>
                        {mediaLibrary.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title} ({item.file_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Media Collection</div>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                          onClick={() => addMediaItem(selectedNodeId)}
                        >
                          Add Photo
                        </button>
                      </div>

                      <div className="text-xs text-foreground/60">
                        Add many jewelry photos here. They will be sent one by one in this order.
                      </div>

                      {mediaItems.length === 0 ? (
                        <div className="text-xs text-foreground/60">No media items added yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {mediaItems.map((item, index) => (
                            <div key={`${selectedNodeId}-media-${index}`} className="rounded-lg border p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium">Item {index + 1}</div>
                                <button
                                  type="button"
                                  className="rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => removeMediaItem(selectedNodeId, index)}
                                >
                                  Delete
                                </button>
                              </div>

                              <select
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                value={item.mediaType || 'image'}
                                onChange={(e) => updateMediaItem(selectedNodeId, index, 'mediaType', e.target.value)}
                              >
                                <option value="image">image</option>
                                <option value="video">video</option>
                                <option value="document">document</option>
                              </select>

                              <input
                                type="text"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Media URL"
                                value={item.mediaUrl || ''}
                                onChange={(e) => updateMediaItem(selectedNodeId, index, 'mediaUrl', e.target.value)}
                              />

                              <input
                                type="text"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Meta media ID (optional)"
                                value={item.metaMediaId || ''}
                                onChange={(e) => updateMediaItem(selectedNodeId, index, 'metaMediaId', e.target.value)}
                              />

                              <textarea
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Caption"
                                value={item.caption || ''}
                                onChange={(e) => updateMediaItem(selectedNodeId, index, 'caption', e.target.value)}
                                rows={2}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Media Type</label>
                      <select
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        value={selectedNode?.data.mediaType || ''}
                        onChange={(e) => updateNodeData(selectedNodeId, 'mediaType', e.target.value)}
                      >
                        <option value="">Select media type</option>
                        <option value="image">image</option>
                        <option value="video">video</option>
                        <option value="document">document</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Media URL</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        placeholder="Auto-filled from media library or paste URL"
                        value={selectedNode?.data.mediaUrl || ''}
                        onChange={(e) => updateNodeData(selectedNodeId, 'mediaUrl', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Meta Media ID (Optional)</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        placeholder="Use existing media ID instead of URL"
                        value={selectedNode?.data.metaMediaId || ''}
                        onChange={(e) => updateNodeData(selectedNodeId, 'metaMediaId', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Caption (Optional)</label>
                      <textarea
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        placeholder="Caption text"
                        value={selectedNode?.data.caption || ''}
                        onChange={(e) => updateNodeData(selectedNodeId, 'caption', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                );
              }

              if (selectedNode?.type === 'triggerKeyword') {
                const keywords = getKeywordList(selectedNodeId);
                return (
                  <div className="space-y-4">
                    <div className="text-xs text-foreground/60">
                      Workflow runs only when the incoming message contains one of these keywords.
                    </div>

                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Keywords</div>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                          onClick={() => addKeyword(selectedNodeId)}
                        >
                          Add Keyword
                        </button>
                      </div>

                      {keywords.length === 0 ? (
                        <div className="text-xs text-foreground/60">No keywords yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {keywords.map((keyword, index) => (
                            <div key={`${selectedNodeId}-keyword-${index}`} className="flex items-center gap-2">
                              <input
                                type="text"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                placeholder={`Keyword ${index + 1}`}
                                value={keyword}
                                onChange={(e) => updateKeyword(selectedNodeId, index, e.target.value)}
                              />
                              <button
                                type="button"
                                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                                onClick={() => removeKeyword(selectedNodeId, index)}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-lg text-xs ${
                        linkSourceNodeId === selectedNodeId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                      onClick={() => setLinkSourceNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId))}
                    >
                      {linkSourceNodeId === selectedNodeId ? 'Cancel Link Mode' : 'Link From This Node'}
                    </button>
                  </div>
                  {linkSourceNodeId === selectedNodeId ? (
                    <div className="text-xs text-foreground/60">
                      Click a target node on canvas to draw link.
                    </div>
                  ) : null}

                  {template.config.map((field: NodeConfigField) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder={field.placeholder}
                          value={selectedNode?.data[field.key] || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, field.key, e.target.value)}
                          rows={3}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          value={selectedNode?.data[field.key] || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, field.key, e.target.value)}
                        >
                          <option value="">Select {field.label.toLowerCase()}</option>
                          {field.options?.map((option: string) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder={field.placeholder}
                          value={selectedNode?.data[field.key] || ''}
                          onChange={(e) => updateNodeData(selectedNodeId, field.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderContent {...props} />
    </ReactFlowProvider>
  );
}

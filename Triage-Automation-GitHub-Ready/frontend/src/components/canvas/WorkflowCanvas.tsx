import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { SidebarPalette } from './SidebarPalette';
import { CanvasHeader } from './CanvasHeader';
import { NodeConfigDrawer } from '../config/NodeConfigDrawer';
import { TriggerPayloadModal } from './TriggerPayloadModal';
import { ExecutionOverlay } from './ExecutionOverlay';

import {
  getDefaultConfig,
  serializeWorkflow,
  deserializeWorkflow,
  type CustomNode,
} from '../../utils/serialization';
import type {
  WorkflowDefinition,
  NodeType,
  TriggerConfig,
  ExecutionRun,
} from '../../api/types';
import { saveWorkflow, executeWorkflow, getRun } from '../../api/workflows';

interface WorkflowCanvasInnerProps {
  initialWorkflow?: WorkflowDefinition | null;
  onBackToList: () => void;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasInnerProps> = ({
  initialWorkflow,
  onBackToList,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [workflowId, setWorkflowId] = useState<string | undefined>(
    initialWorkflow?.workflow_id
  );
  const [workflowName, setWorkflowName] = useState<string>(
    initialWorkflow?.name || 'My New Workflow'
  );
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>(
    initialWorkflow?.trigger || { type: 'manual', config: {} }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [currentRun, setCurrentRun] = useState<ExecutionRun | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Initialize nodes and edges on mount or when initialWorkflow changes
  useEffect(() => {
    if (initialWorkflow) {
      const deserialized = deserializeWorkflow(initialWorkflow);
      setNodes(deserialized.nodes);
      setEdges(deserialized.edges);
      setWorkflowName(deserialized.name);
      setTriggerConfig(deserialized.trigger);
      setWorkflowId(initialWorkflow.workflow_id);
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    } else {
      // Default initial starter node
      const defaultNode: CustomNode = {
        id: 'http_1',
        type: 'http_request',
        position: { x: 250, y: 200 },
        data: {
          node_id: 'http_1',
          type: 'http_request',
          name: 'Fetch User Data',
          config: getDefaultConfig('http_request'),
          on_error: 'fail',
          retry_count: 0,
        },
      };
      setNodes([defaultNode]);
      setEdges([]);
    }
  }, [initialWorkflow, setNodes, setEdges, fitView]);

  // Connect handler
  const onConnect = useCallback(
    (params: Connection) => {
      const isConditional = params.sourceHandle === 'true' || params.sourceHandle === 'false';
      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        animated: true,
        label: isConditional ? (params.sourceHandle === 'true' ? 'True' : 'False') : undefined,
        style: {
          stroke:
            params.sourceHandle === 'true'
              ? '#10b981'
              : params.sourceHandle === 'false'
              ? '#f43f5e'
              : '#64748b',
          strokeWidth: 2,
        },
        data: {
          branch: params.sourceHandle || null,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setHasUnsavedChanges(true);
    },
    [setEdges]
  );

  // Drag & drop new node onto canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const count = nodes.filter((n) => n.data.type === nodeType).length + 1;
      const nodeId = `${nodeType.slice(0, 4)}_${count}`;

      const newNode: CustomNode = {
        id: nodeId,
        type: nodeType,
        position,
        data: {
          node_id: nodeId,
          type: nodeType,
          name: `${nodeType.replace('_', ' ').toUpperCase()} ${count}`,
          config: getDefaultConfig(nodeType),
          on_error: 'fail',
          retry_count: 0,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(nodeId);
      setHasUnsavedChanges(true);
    },
    [nodes, screenToFlowPosition, setNodes]
  );

  // Select node for editing
  const onNodeClick = useCallback((_: React.MouseEvent, node: CustomNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Update node data from drawer
  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<CustomNode['data']>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            };
          }
          return node;
        })
      );
      setHasUnsavedChanges(true);
    },
    [setNodes]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      setHasUnsavedChanges(true);
    },
    [selectedNodeId, setEdges, setNodes]
  );

  // Save workflow to backend
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = serializeWorkflow(
        workflowName,
        triggerConfig,
        nodes,
        edges,
        workflowId
      );

      const res = await saveWorkflow(payload);
      setWorkflowId(res.workflow_id);
      setHasUnsavedChanges(false);
      setNotification({
        type: 'success',
        message: 'Workflow saved successfully to Supabase!',
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to save: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Run execution and poll status
  const handleExecute = async (triggerPayload: Record<string, any>) => {
    // Save first if unsaved or without workflowId
    let targetWorkflowId = workflowId;
    if (!targetWorkflowId || hasUnsavedChanges) {
      setIsSaving(true);
      try {
        const payload = serializeWorkflow(
          workflowName,
          triggerConfig,
          nodes,
          edges,
          workflowId
        );
        const saveRes = await saveWorkflow(payload);
        targetWorkflowId = saveRes.workflow_id;
        setWorkflowId(targetWorkflowId);
        setHasUnsavedChanges(false);
      } catch (err: any) {
        setNotification({
          type: 'error',
          message: `Save before run failed: ${err.message}`,
        });
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    // Reset node execution visual states
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'running',
          output: null,
          error: null,
        },
      }))
    );

    setIsRunning(true);
    setCurrentRun(null);

    try {
      const execRes = await executeWorkflow(targetWorkflowId!, triggerPayload);
      const runId = execRes.run_id;

      // Poll run status
      const pollInterval = setInterval(async () => {
        try {
          const runDetails = await getRun(runId);
          setCurrentRun(runDetails);

          // Update node logs on canvas
          if (runDetails.node_logs) {
            const logsMap = new Map(runDetails.node_logs.map((l) => [l.node_id, l]));
            setNodes((nds) =>
              nds.map((n) => {
                const log = logsMap.get(n.id);
                if (log) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      status: log.status,
                      output: log.output,
                      error: log.error,
                    },
                  };
                }
                return n;
              })
            );
          }

          if (runDetails.status === 'success' || runDetails.status === 'failed') {
            clearInterval(pollInterval);
            setIsRunning(false);
          }
        } catch {
          clearInterval(pollInterval);
          setIsRunning(false);
        }
      }, 800);
    } catch (err: any) {
      setIsRunning(false);
      setNotification({
        type: 'error',
        message: `Execution failed to start: ${err.message}`,
      });
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, status: undefined },
        }))
      );
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <CanvasHeader
        workflowId={workflowId}
        workflowName={workflowName}
        triggerConfig={triggerConfig}
        onNameChange={(name) => {
          setWorkflowName(name);
          setHasUnsavedChanges(true);
        }}
        onSave={handleSave}
        onRunClick={() => setShowTriggerModal(true)}
        onBackToList={onBackToList}
        onTriggerUpdated={(newTrig) => {
          setTriggerConfig(newTrig);
          setHasUnsavedChanges(true);
        }}
        isSaving={isSaving}
        isRunning={isRunning}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/90 border-rose-800 text-rose-200'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex-1 flex relative overflow-hidden" ref={reactFlowWrapper}>
        <SidebarPalette />

        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#64748b', strokeWidth: 2 },
            }}
          >
            <Controls className="!bg-slate-900 !border-slate-800 !fill-slate-300 !text-slate-300" />
            <MiniMap
              nodeColor={(n) => {
                switch (n.type) {
                  case 'http_request':
                    return '#38bdf8';
                  case 'conditional':
                    return '#f59e0b';
                  case 'code':
                    return '#a855f7';
                  case 'delay':
                    return '#94a3b8';
                  case 'llm':
                    return '#10b981';
                  default:
                    return '#64748b';
                }
              }}
              maskColor="rgba(15, 23, 42, 0.7)"
              className="!bg-slate-950 !border-slate-800 rounded-lg overflow-hidden"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="#334155"
            />
          </ReactFlow>

          {/* Node Config Drawer */}
          {selectedNode && (
            <NodeConfigDrawer
              selectedNode={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
            />
          )}

          {/* Execution Status Overlay */}
          <ExecutionOverlay
            run={currentRun}
            isRunning={isRunning}
            onClear={() => {
              setCurrentRun(null);
              setNodes((nds) =>
                nds.map((n) => ({
                  ...n,
                  data: { ...n.data, status: undefined },
                }))
              );
            }}
          />
        </div>
      </div>

      <TriggerPayloadModal
        isOpen={showTriggerModal}
        onClose={() => setShowTriggerModal(false)}
        onRun={handleExecute}
        isRunning={isRunning}
      />
    </div>
  );
};

export const WorkflowCanvas: React.FC<WorkflowCanvasInnerProps> = (props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

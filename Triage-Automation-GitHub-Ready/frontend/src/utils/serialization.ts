import type { Node, Edge } from '@xyflow/react';
import type {
  WorkflowDefinition,
  NodeDefinition,
  EdgeDefinition,
  TriggerConfig,
  NodeType,
  OnErrorPolicy,
  HttpRequestConfig,
  LlmConfig,
} from '../api/types';

export interface WorkflowNodeData extends Record<string, unknown> {
  node_id: string;
  type: NodeType;
  name: string;
  config: Record<string, any>;
  on_error: OnErrorPolicy;
  retry_count: number;
  status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: Record<string, any> | null;
  error?: string | null;
}

export type CustomNode = Node<WorkflowNodeData>;

export function getDefaultConfig(type: NodeType): Record<string, any> {
  switch (type) {
    case 'http_request': {
      const httpCfg: HttpRequestConfig = {
        url: 'https://api.github.com/zen',
        method: 'GET',
        headers: {},
        body: null,
        timeout_seconds: 30,
        credential_id: undefined,
      };
      return httpCfg;
    }
    case 'conditional':
      return {
        condition: '{{trigger.score}} > 70',
      };
    case 'code':
      return {
        code: "result = {'message': 'Hello from Code Node', 'trigger_data': input_data['trigger']}",
        timeout_seconds: 10,
      };
    case 'delay':
      return {
        duration_seconds: 2,
      };
    case 'llm': {
      const llmCfg: LlmConfig = {
        prompt: 'Summarize the following event: {{trigger.event}}',
        system_prompt: 'You are a helpful AI automation assistant.',
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        credential_id: undefined,
      };
      return llmCfg;
    }
    default:
      return {};
  }
}

/**
 * Converts React Flow canvas nodes & edges to a backend WorkflowDefinition JSON payload.
 */
export function serializeWorkflow(
  name: string,
  trigger: TriggerConfig,
  nodes: CustomNode[],
  edges: Edge[],
  workflowId?: string,
  version = 1
): WorkflowDefinition {
  const nodeDefinitions: NodeDefinition[] = nodes.map((node) => {
    const data = node.data;
    return {
      node_id: node.id,
      type: (node.type as NodeType) || data.type || 'http_request',
      name: data.name || node.id,
      config: data.config || {},
      on_error: data.on_error || 'fail',
      retry_count: data.on_error === 'retry' ? (data.retry_count || 1) : 0,
    };
  });

  const edgeDefinitions: EdgeDefinition[] = edges.map((edge) => {
    let branch: string | null = null;
    if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
      branch = edge.sourceHandle;
    } else if (edge.data && typeof edge.data.branch === 'string') {
      branch = edge.data.branch;
    }

    return {
      from_node: edge.source,
      to_node: edge.target,
      branch: branch || undefined,
    };
  });

  return {
    workflow_id: workflowId,
    name: name || 'Untitled Workflow',
    version,
    trigger,
    nodes: nodeDefinitions,
    edges: edgeDefinitions,
  };
}

/**
 * Converts a backend WorkflowDefinition into React Flow nodes & edges with auto-layout.
 */
export function deserializeWorkflow(workflow: WorkflowDefinition): {
  nodes: CustomNode[];
  edges: Edge[];
  trigger: TriggerConfig;
  name: string;
} {
  // Simple topological level layout
  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  workflow.nodes.forEach((n) => {
    adjacency[n.node_id] = [];
    inDegree[n.node_id] = 0;
  });

  workflow.edges.forEach((e) => {
    if (adjacency[e.from_node]) adjacency[e.from_node].push(e.to_node);
    if (inDegree[e.to_node] !== undefined) inDegree[e.to_node]++;
  });

  // Calculate hierarchical levels
  const levels: Record<string, number> = {};
  const queue: string[] = [];
  workflow.nodes.forEach((n) => {
    if (inDegree[n.node_id] === 0) {
      queue.push(n.node_id);
      levels[n.node_id] = 0;
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const curLevel = levels[current] || 0;
    for (const neighbor of adjacency[current] || []) {
      levels[neighbor] = Math.max(levels[neighbor] || 0, curLevel + 1);
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Group nodes by level to assign (x, y) coordinates
  const levelBuckets: Record<number, string[]> = {};
  workflow.nodes.forEach((n) => {
    const lvl = levels[n.node_id] || 0;
    if (!levelBuckets[lvl]) levelBuckets[lvl] = [];
    levelBuckets[lvl].push(n.node_id);
  });

  const nodes: CustomNode[] = workflow.nodes.map((n) => {
    const lvl = levels[n.node_id] || 0;
    const bucket = levelBuckets[lvl] || [n.node_id];
    const indexInBucket = bucket.indexOf(n.node_id);

    const x = 100 + lvl * 320;
    const y = 100 + indexInBucket * 180;

    return {
      id: n.node_id,
      type: n.type,
      position: { x, y },
      data: {
        node_id: n.node_id,
        type: n.type as NodeType,
        name: n.name,
        config: n.config || {},
        on_error: n.on_error,
        retry_count: n.retry_count,
      },
    };
  });

  const edges: Edge[] = workflow.edges.map((e, idx) => {
    return {
      id: `e-${e.from_node}-${e.to_node}-${idx}`,
      source: e.from_node,
      target: e.to_node,
      sourceHandle: e.branch || undefined,
      label: e.branch ? (e.branch === 'true' ? 'True' : 'False') : undefined,
      animated: true,
      style: {
        stroke: e.branch === 'true' ? '#10b981' : e.branch === 'false' ? '#f43f5e' : '#64748b',
        strokeWidth: 2,
      },
      data: {
        branch: e.branch || null,
      },
    };
  });

  return {
    nodes,
    edges,
    trigger: workflow.trigger,
    name: workflow.name,
  };
}

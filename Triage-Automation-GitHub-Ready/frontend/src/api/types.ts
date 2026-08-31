/**
 * TypeScript definitions mapping directly to Python backend Pydantic models:
 * - app/models/node.py (NodeDefinition)
 * - app/models/workflow.py (WorkflowDefinition, EdgeDefinition, TriggerConfig)
 * - app/models/execution.py (ExecutionRun, NodeExecutionLog)
 * - app/models/credential.py (Credential)
 */

export type NodeType = 'http_request' | 'conditional' | 'code' | 'delay' | 'llm';

export type OnErrorPolicy = 'fail' | 'continue' | 'retry';

export type TriggerType = 'manual' | 'webhook' | 'cron';

export type CredentialType = 'api_key' | 'bearer_token' | 'basic_auth' | 'custom_header';

export interface CredentialMetadata {
  credential_id: string;
  name: string;
  type: CredentialType;
  created_at: string;
  updated_at?: string;
}

export interface CreateCredentialPayload {
  name: string;
  type: CredentialType;
  value: string;
}

export interface TriggerConfig {
  type: TriggerType;
  config: Record<string, any>;
}

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout_seconds?: number;
  credential_id?: string;
}

export interface ConditionalConfig {
  condition: string;
}

export interface CodeConfig {
  code: string;
  timeout_seconds?: number;
}

export interface DelayConfig {
  duration_seconds: number;
}

export interface LlmConfig {
  prompt: string;
  system_prompt?: string;
  model?: string;
  max_tokens?: number;
  credential_id?: string;
}

export type NodeConfigMap = {
  http_request: HttpRequestConfig;
  conditional: ConditionalConfig;
  code: CodeConfig;
  delay: DelayConfig;
  llm: LlmConfig;
};

export interface NodeDefinition {
  node_id: string;
  type: NodeType | string;
  name: string;
  config: Record<string, any>;
  on_error: OnErrorPolicy;
  retry_count: number;
}

export interface EdgeDefinition {
  from_node: string;
  to_node: string;
  branch?: string | null;
}

export interface WorkflowDefinition {
  workflow_id?: string;
  name: string;
  version: number;
  trigger: TriggerConfig;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  webhook_token?: string | null;
  webhook_url?: string | null;
  has_secret?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed';
export type NodeLogStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface NodeExecutionLog {
  id?: number;
  run_id: string;
  node_id: string;
  status: NodeLogStatus;
  output?: Record<string, any> | null;
  error?: string | null;
  started_at: string;
  finished_at?: string | null;
}

export interface ExecutionRun {
  run_id: string;
  workflow_id: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at?: string | null;
  trigger_payload: Record<string, any>;
  node_logs?: NodeExecutionLog[];
}

export interface ExecutionRunSummary {
  run_id: string;
  workflow_id: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at?: string | null;
  duration_seconds?: number | null;
  trigger_type: 'manual' | 'webhook';
  node_counts: {
    success: number;
    failed: number;
    skipped: number;
    total: number;
  };
}

export interface WorkflowRunsResponse {
  workflow_id: string;
  runs: ExecutionRunSummary[];
  limit: number;
  offset: number;
}

export interface WebhookConfigResponse {
  workflow_id: string;
  trigger_type: 'webhook';
  webhook_token: string;
  webhook_url: string;
  has_secret: boolean;
  secret?: string;
}

export interface WorkflowSummary {
  workflow_id: string;
  name: string;
  version: number;
  trigger: TriggerConfig;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  webhook_token?: string | null;
  webhook_url?: string | null;
  has_secret?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
  limit: number;
  offset: number;
}

export interface ExecuteWorkflowResponse {
  run_id: string;
  workflow_id: string;
  status: 'success' | 'failed';
  error?: string;
}

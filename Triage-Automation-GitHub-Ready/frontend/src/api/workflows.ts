import { apiFetch } from './client';
import type {
  WorkflowDefinition,
  WorkflowListResponse,
  WorkflowSummary,
  ExecuteWorkflowResponse,
  ExecutionRun,
  WorkflowRunsResponse,
  WebhookConfigResponse,
} from './types';

export async function listWorkflows(limit = 50, offset = 0): Promise<WorkflowListResponse> {
  return apiFetch<WorkflowListResponse>(`/workflows?limit=${limit}&offset=${offset}`);
}

export async function getWorkflow(workflowId: string): Promise<WorkflowSummary> {
  return apiFetch<WorkflowSummary>(`/workflows/${workflowId}`);
}

export async function saveWorkflow(
  workflow: WorkflowDefinition
): Promise<{ workflow_id: string; warnings?: string[] }> {
  return apiFetch<{ workflow_id: string; warnings?: string[] }>('/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });
}

export async function executeWorkflow(
  workflowId: string,
  triggerPayload: Record<string, any> = {}
): Promise<ExecuteWorkflowResponse> {
  return apiFetch<ExecuteWorkflowResponse>(`/workflows/${workflowId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ trigger_payload: triggerPayload }),
  });
}

export async function getRun(runId: string): Promise<ExecutionRun> {
  return apiFetch<ExecutionRun>(`/runs/${runId}`);
}

export async function listWorkflowRuns(
  workflowId: string,
  limit = 20,
  offset = 0
): Promise<WorkflowRunsResponse> {
  return apiFetch<WorkflowRunsResponse>(
    `/workflows/${workflowId}/runs?limit=${limit}&offset=${offset}`
  );
}

export async function configureWorkflowWebhook(
  workflowId: string,
  payload?: { secret?: string; generate_secret?: boolean }
): Promise<WebhookConfigResponse> {
  return apiFetch<WebhookConfigResponse>(`/workflows/${workflowId}/webhook`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function revokeWorkflowWebhook(
  workflowId: string
): Promise<{ message: string; trigger_type: string }> {
  return apiFetch<{ message: string; trigger_type: string }>(
    `/workflows/${workflowId}/webhook`,
    {
      method: 'DELETE',
    }
  );
}

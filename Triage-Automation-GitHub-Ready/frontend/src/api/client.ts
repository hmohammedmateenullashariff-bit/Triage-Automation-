/**
 * API client attaching X-API-Key header to all requests.
 */

const DEFAULT_API_KEY = 'dev-api-key';

export function getApiKey(): string {
  return localStorage.getItem('WORKFLOW_API_KEY') || DEFAULT_API_KEY;
}

export function setApiKey(key: string): void {
  localStorage.setItem('WORKFLOW_API_KEY', key);
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('X-API-Key')) {
    headers.set('X-API-Key', getApiKey());
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || (data.details ? JSON.stringify(data.details) : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}

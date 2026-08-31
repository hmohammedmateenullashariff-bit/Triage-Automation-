import { apiFetch } from './client';
import type {
  CredentialMetadata,
  CreateCredentialPayload,
} from './types';

export interface CredentialsListResponse {
  credentials: CredentialMetadata[];
}

export async function listCredentials(): Promise<CredentialsListResponse> {
  return apiFetch<CredentialsListResponse>('/credentials');
}

export async function createCredential(
  payload: CreateCredentialPayload
): Promise<CredentialMetadata> {
  return apiFetch<CredentialMetadata>('/credentials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteCredential(credentialId: string): Promise<void> {
  return apiFetch<void>(`/credentials/${credentialId}`, {
    method: 'DELETE',
  });
}

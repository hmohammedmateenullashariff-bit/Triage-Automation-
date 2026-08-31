import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Trash2,
  Plus,
  Lock,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Key,
} from 'lucide-react';
import type { CredentialMetadata, CredentialType, CreateCredentialPayload } from '../../api/types';
import { listCredentials, createCredential, deleteCredential } from '../../api/credentials';

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialCreated?: (credential: CredentialMetadata) => void;
  onCredentialsChange?: () => void;
}

const TYPE_CONFIG: Record<
  CredentialType,
  { label: string; placeholder: string; badgeColor: string; description: string }
> = {
  api_key: {
    label: 'API Key',
    placeholder: 'sk-ant-api03-... or secret_key_...',
    badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-800',
    description: 'Injected into Authorization header or LLM API client',
  },
  bearer_token: {
    label: 'Bearer Token',
    placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
    badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-800',
    description: 'Injected as Authorization: Bearer <token>',
  },
  basic_auth: {
    label: 'Basic Auth',
    placeholder: 'username:password or base64 string',
    badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800',
    description: 'Injected as Authorization: Basic <credentials>',
  },
  custom_header: {
    label: 'Custom Header',
    placeholder: 'X-Service-Token: my-secret-token',
    badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    description: 'Format: "Header-Name: value" or token for X-Custom-Auth',
  },
};

export const CredentialModal: React.FC<CredentialModalProps> = ({
  isOpen,
  onClose,
  onCredentialCreated,
  onCredentialsChange,
}) => {
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('api_key');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCreds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCredentials();
      setCredentials(res.credentials || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCreds();
      setName('');
      setValue('');
      setFormError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a credential name');
      return;
    }
    if (!value.trim()) {
      setFormError('Please enter the secret value');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);

    try {
      const payload: CreateCredentialPayload = {
        name: name.trim(),
        type,
        value: value.trim(),
      };
      const created = await createCredential(payload);
      setSuccessMsg(`Credential "${created.name}" encrypted and stored successfully!`);
      setName('');
      setValue('');
      await fetchCreds();
      if (onCredentialCreated) onCredentialCreated(created);
      if (onCredentialsChange) onCredentialsChange();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, credName: string) => {
    if (!window.confirm(`Are you sure you want to delete credential "${credName}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteCredential(id);
      setCredentials((prev) => prev.filter((c) => c.credential_id !== id));
      if (onCredentialsChange) onCredentialsChange();
    } catch (err: any) {
      alert(`Failed to delete credential: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-950/50">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Credential Store
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800">
                  AES-256 Fernet Encrypted
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Securely store API keys and secrets. Values are encrypted on write and decrypted only at node runtime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Create Form Section */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Add New Credential</span>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Credential Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Anthropic API Key, Stripe Prod"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Credential Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CredentialType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="api_key">API Key</option>
                    <option value="bearer_token">Bearer Token</option>
                    <option value="basic_auth">Basic Auth</option>
                    <option value="custom_header">Custom Header</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Secret Value (Encrypted on write)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {TYPE_CONFIG[type].description}
                  </span>
                </div>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={TYPE_CONFIG[type].placeholder}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-900/60">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-950/50 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span>{submitting ? 'Encrypting & Saving...' : 'Save Credential'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Stored Credentials List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Stored Credentials ({credentials.length})</span>
              </h3>
              <button
                onClick={fetchCreds}
                disabled={loading}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline decoration-slate-600"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading credentials...</span>
              </div>
            ) : error ? (
              <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900/60">
                {error}
              </div>
            ) : credentials.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No credentials stored yet.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Add your first credential above to reference it across HTTP & LLM nodes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                {credentials.map((cred) => {
                  const conf = TYPE_CONFIG[cred.type] || TYPE_CONFIG.api_key;
                  return (
                    <div
                      key={cred.credential_id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {cred.name}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${conf.badgeColor}`}
                          >
                            {conf.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                          <span>ID: {cred.credential_id}</span>
                          <span>•</span>
                          <span>Added {new Date(cred.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(cred.credential_id, cred.name)}
                        disabled={deletingId === cred.credential_id}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors ml-3 disabled:opacity-50"
                        title="Delete Credential"
                      >
                        {deletingId === cred.credential_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Zero plaintext exposure in logs and API responses</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

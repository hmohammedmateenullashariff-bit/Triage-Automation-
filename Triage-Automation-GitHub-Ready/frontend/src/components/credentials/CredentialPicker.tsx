import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Lock, CheckCircle, RefreshCw, KeyRound } from 'lucide-react';
import type { CredentialMetadata, CredentialType } from '../../api/types';
import { listCredentials } from '../../api/credentials';
import { CredentialModal } from './CredentialModal';

interface CredentialPickerProps {
  value?: string;
  onChange: (credentialId?: string) => void;
  allowedTypes?: CredentialType[];
  label?: string;
  defaultOptionLabel?: string;
  accentColor?: 'sky' | 'emerald' | 'indigo';
}

export const CredentialPicker: React.FC<CredentialPickerProps> = ({
  value,
  onChange,
  allowedTypes,
  label = 'Authentication Credential',
  defaultOptionLabel = 'None (Public / Manual Headers)',
  accentColor = 'sky',
}) => {
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchCreds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCredentials();
      setCredentials(res.credentials || []);
    } catch {
      // ignore in selector
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreds();
  }, [fetchCreds]);

  const filteredCredentials = allowedTypes
    ? credentials.filter((c) => allowedTypes.includes(c.type))
    : credentials;

  const selectedCred = credentials.find((c) => c.credential_id === value);

  const handleCreated = (newCred: CredentialMetadata) => {
    fetchCreds();
    onChange(newCred.credential_id);
  };

  const focusRing =
    accentColor === 'emerald'
      ? 'focus:border-emerald-500'
      : accentColor === 'indigo'
      ? 'focus:border-indigo-500'
      : 'focus:border-sky-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Manage Credentials</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            disabled={loading}
            className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none ${focusRing} appearance-none cursor-pointer`}
          >
            <option value="">{defaultOptionLabel}</option>
            {filteredCredentials.map((c) => (
              <option key={c.credential_id} value={c.credential_id}>
                [{c.type.toUpperCase()}] {c.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">
            ▼
          </div>
        </div>

        <button
          type="button"
          onClick={fetchCreds}
          disabled={loading}
          title="Refresh credentials list"
          className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {selectedCred ? (
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-200">{selectedCred.name}</span>
              <span className="text-slate-500 font-mono ml-2">({selectedCred.type})</span>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            <CheckCircle className="w-3 h-3" />
            Redacted in logs
          </span>
        </div>
      ) : (
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <KeyRound className="w-3 h-3 text-slate-600" />
          <span>Reference stored secret by ID. Values are encrypted at rest.</span>
        </p>
      )}

      <CredentialModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCredentialCreated={handleCreated}
        onCredentialsChange={fetchCreds}
      />
    </div>
  );
};

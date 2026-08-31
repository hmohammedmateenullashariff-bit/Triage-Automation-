import React, { useState } from 'react';
import type { HttpRequestConfig } from '../../api/types';
import { CredentialPicker } from '../credentials/CredentialPicker';

interface HttpConfigFormProps {
  config: HttpRequestConfig;
  onChange: (config: HttpRequestConfig) => void;
}

export const HttpConfigForm: React.FC<HttpConfigFormProps> = ({ config, onChange }) => {
  const [headersRaw, setHeadersRaw] = useState(
    JSON.stringify(config.headers || {}, null, 2)
  );
  const [bodyRaw, setBodyRaw] = useState(
    config.body ? JSON.stringify(config.body, null, 2) : ''
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleHeadersChange = (val: string) => {
    setHeadersRaw(val);
    try {
      const parsed = val.trim() ? JSON.parse(val) : {};
      setJsonError(null);
      onChange({ ...config, headers: parsed });
    } catch {
      setJsonError('Headers must be valid JSON object');
    }
  };

  const handleBodyChange = (val: string) => {
    setBodyRaw(val);
    try {
      const parsed = val.trim() ? JSON.parse(val) : null;
      setJsonError(null);
      onChange({ ...config, body: parsed });
    } catch {
      setJsonError('Body must be valid JSON');
    }
  };

  const handleCredentialChange = (credentialId?: string) => {
    onChange({
      ...config,
      credential_id: credentialId,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          HTTP Method
        </label>
        <select
          value={config.method || 'GET'}
          onChange={(e) =>
            onChange({
              ...config,
              method: e.target.value as HttpRequestConfig['method'],
            })
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">URL</label>
          <span className="text-[10px] text-slate-400">Supports template tags</span>
        </div>
        <input
          type="text"
          value={config.url || ''}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/items/{{trigger.item_id}}"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Credential Selector */}
      <div className="pt-1 pb-1">
        <CredentialPicker
          value={config.credential_id}
          onChange={handleCredentialChange}
          label="Authentication Credential (Optional)"
          defaultOptionLabel="None (Public Endpoint or Manual Headers)"
          accentColor="sky"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">Headers (JSON)</label>
          <span className="text-[10px] text-slate-400 font-mono">{"{\"Header\": \"Value\"}"}</span>
        </div>
        <textarea
          rows={3}
          value={headersRaw}
          onChange={(e) => handleHeadersChange(e.target.value)}
          placeholder={'{\n  "Accept": "application/json"\n}'}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
        />
        {config.credential_id && (
          <p className="text-[10px] text-sky-400 mt-1">
            ℹ️ Selected credential will inject the Authorization header at runtime automatically.
          </p>
        )}
      </div>

      {['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method || 'GET') && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-300">Body (JSON)</label>
            <span className="text-[10px] text-slate-400">Payload</span>
          </div>
          <textarea
            rows={4}
            value={bodyRaw}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder={'{\n  "name": "{{trigger.user_name}}",\n  "status": "active"\n}'}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Timeout (seconds)
        </label>
        <input
          type="number"
          min={1}
          max={300}
          value={config.timeout_seconds || 30}
          onChange={(e) =>
            onChange({
              ...config,
              timeout_seconds: parseInt(e.target.value, 10) || 30,
            })
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
        />
      </div>

      {jsonError && (
        <div className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/60">
          {jsonError}
        </div>
      )}
    </div>
  );
};

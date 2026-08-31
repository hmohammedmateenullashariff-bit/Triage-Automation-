import React from 'react';
import type { LlmConfig } from '../../api/types';
import { CredentialPicker } from '../credentials/CredentialPicker';

interface LlmConfigFormProps {
  config: LlmConfig;
  onChange: (config: LlmConfig) => void;
}

export const LlmConfigForm: React.FC<LlmConfigFormProps> = ({ config, onChange }) => {
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
          Model
        </label>
        <select
          value={config.model || 'claude-3-5-haiku-20241022'}
          onChange={(e) => onChange({ ...config, model: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast & Cheap)</option>
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (High Intelligence)</option>
          <option value="claude-3-opus-20240229">Claude 3 Opus</option>
        </select>
      </div>

      {/* Credential Selector */}
      <div className="pt-1 pb-1">
        <CredentialPicker
          value={config.credential_id}
          onChange={handleCredentialChange}
          allowedTypes={['api_key', 'bearer_token']}
          label="Anthropic API Key Credential"
          defaultOptionLabel="Default (ANTHROPIC_API_KEY env var)"
          accentColor="emerald"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">
            System Prompt
          </label>
          <span className="text-[10px] text-slate-400">Optional</span>
        </div>
        <textarea
          rows={2}
          value={config.system_prompt || ''}
          onChange={(e) => onChange({ ...config, system_prompt: e.target.value })}
          placeholder="You are an automated triage classifier..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">
            User Prompt Template
          </label>
          <span className="text-[10px] text-emerald-400 font-mono">Supports templates</span>
        </div>
        <textarea
          rows={5}
          value={config.prompt || ''}
          onChange={(e) => onChange({ ...config, prompt: e.target.value })}
          placeholder="Analyze this payload: {{trigger.message}}\nOutput sentiment: positive, negative, or neutral."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Max Tokens
        </label>
        <input
          type="number"
          min={1}
          max={4096}
          value={config.max_tokens || 1024}
          onChange={(e) =>
            onChange({
              ...config,
              max_tokens: parseInt(e.target.value, 10) || 1024,
            })
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        />
      </div>
    </div>
  );
};

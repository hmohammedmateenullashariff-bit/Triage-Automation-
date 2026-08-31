import React from 'react';
import type { CodeConfig } from '../../api/types';

interface CodeConfigFormProps {
  config: CodeConfig;
  onChange: (config: CodeConfig) => void;
}

export const CodeConfigForm: React.FC<CodeConfigFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">Python Script</label>
          <span className="text-[10px] text-purple-400 font-mono">Subprocess sandbox</span>
        </div>
        <textarea
          rows={10}
          value={config.code || ''}
          onChange={(e) => onChange({ ...config, code: e.target.value })}
          placeholder={`# input_data is automatically available:\n# input_data['trigger']\n# input_data['node_outputs']\n\nval = input_data['trigger'].get('count', 1)\nresult = {\n    'computed': val * 10,\n    'status': 'processed'\n}`}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500 leading-relaxed"
        />
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 space-y-1">
        <p className="text-slate-300 font-medium">Important:</p>
        <p>Your script must assign a dictionary to the global variable <code className="text-purple-300 font-mono">result = {'{...}'}</code>. That dictionary becomes the node's output payload.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Execution Timeout (seconds)
        </label>
        <input
          type="number"
          min={1}
          max={60}
          value={config.timeout_seconds || 10}
          onChange={(e) =>
            onChange({
              ...config,
              timeout_seconds: parseInt(e.target.value, 10) || 10,
            })
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
        />
      </div>
    </div>
  );
};

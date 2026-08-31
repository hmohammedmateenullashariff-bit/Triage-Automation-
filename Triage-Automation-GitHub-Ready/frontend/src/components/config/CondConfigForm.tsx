import React from 'react';
import type { ConditionalConfig } from '../../api/types';

interface CondConfigFormProps {
  config: ConditionalConfig;
  onChange: (config: ConditionalConfig) => void;
}

export const CondConfigForm: React.FC<CondConfigFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">
            Condition Expression
          </label>
          <span className="text-[10px] text-amber-400 font-mono">Safe Eval</span>
        </div>
        <textarea
          rows={3}
          value={config.condition || ''}
          onChange={(e) => onChange({ condition: e.target.value })}
          placeholder="{{trigger.score}} >= 80"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-2">
        <p className="font-semibold text-slate-200">Expression Syntax Guide:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Supported operators: <code className="text-amber-400 font-mono">==, !=, &gt;, &lt;, &gt;=, &lt;=</code></li>
          <li>Access trigger values: <code className="text-sky-300 font-mono">{"{{trigger.user.is_admin}}"}</code></li>
          <li>Access node outputs: <code className="text-purple-300 font-mono">{"{{node_1.output.status_code}} == 200"}</code></li>
          <li>Strings & numbers: <code className="text-emerald-300 font-mono">{"{{trigger.plan}} == 'enterprise'"}</code></li>
        </ul>
      </div>

      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300/90">
        Edges connected to the <strong>True Handle</strong> will execute when this evaluates to true. Edges connected to the <strong>False Handle</strong> will be skipped.
      </div>
    </div>
  );
};

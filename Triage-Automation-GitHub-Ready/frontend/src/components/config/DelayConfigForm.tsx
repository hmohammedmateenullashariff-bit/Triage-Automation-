import React from 'react';
import type { DelayConfig } from '../../api/types';

interface DelayConfigFormProps {
  config: DelayConfig;
  onChange: (config: DelayConfig) => void;
}

export const DelayConfigForm: React.FC<DelayConfigFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300">
            Sleep Duration (seconds)
          </label>
          <span className="text-[10px] text-slate-400">Non-negative integer</span>
        </div>
        <input
          type="number"
          min={0}
          max={300}
          value={config.duration_seconds !== undefined ? config.duration_seconds : 1}
          onChange={(e) =>
            onChange({
              duration_seconds: Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-slate-500"
        />
      </div>

      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400">
        Pauses workflow execution sequentially before moving to the next node in the DAG.
      </div>
    </div>
  );
};

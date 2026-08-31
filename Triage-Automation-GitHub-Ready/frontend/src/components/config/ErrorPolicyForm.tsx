import React from 'react';
import type { OnErrorPolicy } from '../../api/types';

interface ErrorPolicyFormProps {
  onError: OnErrorPolicy;
  retryCount: number;
  onChange: (onError: OnErrorPolicy, retryCount: number) => void;
}

export const ErrorPolicyForm: React.FC<ErrorPolicyFormProps> = ({
  onError,
  retryCount,
  onChange,
}) => {
  return (
    <div className="space-y-3 pt-3 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300">Error Policy</label>
        <span className="text-[10px] text-slate-400">Behavior on failure</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(['fail', 'continue', 'retry'] as OnErrorPolicy[]).map((policy) => (
          <button
            key={policy}
            type="button"
            onClick={() => onChange(policy, policy === 'retry' ? Math.max(1, retryCount) : 0)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${
              onError === policy
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            {policy}
          </button>
        ))}
      </div>

      {onError === 'retry' && (
        <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300">Retry Count</label>
            <span className="text-[10px] text-amber-400 font-mono">1–5 attempts</span>
          </div>
          <input
            type="number"
            min={1}
            max={5}
            value={retryCount || 1}
            onChange={(e) => onChange('retry', Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  );
};

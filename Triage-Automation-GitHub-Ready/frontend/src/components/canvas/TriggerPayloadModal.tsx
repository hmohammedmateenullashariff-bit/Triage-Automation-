import React, { useState } from 'react';
import { X, Play, Code } from 'lucide-react';

interface TriggerPayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (payload: Record<string, any>) => void;
  defaultPayload?: Record<string, any>;
  isRunning?: boolean;
}

export const TriggerPayloadModal: React.FC<TriggerPayloadModalProps> = ({
  isOpen,
  onClose,
  onRun,
  defaultPayload = { message: 'Workflow test trigger', score: 85, user_id: 'usr_123' },
  isRunning = false,
}) => {
  const [rawJson, setRawJson] = useState(JSON.stringify(defaultPayload, null, 2));
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = () => {
    try {
      const parsed = rawJson.trim() ? JSON.parse(rawJson) : {};
      setError(null);
      onRun(parsed);
      onClose();
    } catch (e: any) {
      setError(`Invalid JSON syntax: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Trigger Payload
              </h3>
              <p className="text-[11px] text-slate-400">
                Accessible via <code className="text-sky-300 font-mono">{"{{trigger.<field>}}"}</code>
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

        <div className="p-5 space-y-3">
          <textarea
            rows={8}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500 leading-relaxed"
            placeholder={'{\n  "score": 85,\n  "event": "user_signup"\n}'}
          />

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60 font-mono">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};

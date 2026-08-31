import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
} from 'lucide-react';
import type { ExecutionRun, NodeExecutionLog } from '../../api/types';

interface ExecutionOverlayProps {
  run: ExecutionRun | null;
  isRunning: boolean;
  onClear: () => void;
}

export const ExecutionOverlay: React.FC<ExecutionOverlayProps> = ({
  run,
  isRunning,
  onClear,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NodeExecutionLog | null>(null);

  if (!run && !isRunning) return null;

  const status = run?.status || (isRunning ? 'running' : 'pending');

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Workflow Executing...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Execution Succeeded</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>Execution Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs">
            <Clock className="w-4 h-4" />
            <span>Pending</span>
          </div>
        );
    }
  };

  const logs = run?.node_logs || [];
  const successCount = logs.filter((l) => l.status === 'success').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;
  const skippedCount = logs.filter((l) => l.status === 'skipped').length;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Main Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            {run?.run_id && (
              <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                {run.run_id}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono pr-2">
                {successCount > 0 && (
                  <span className="text-emerald-400 font-bold">{successCount} pass</span>
                )}
                {failedCount > 0 && (
                  <span className="text-rose-400 font-bold">{failedCount} fail</span>
                )}
                {skippedCount > 0 && (
                  <span className="text-slate-500">{skippedCount} skip</span>
                )}
              </div>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title={isExpanded ? 'Collapse logs' : 'Expand logs'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            <button
              onClick={onClear}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
              title="Close overlay"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded Logs Panel */}
        {isExpanded && (
          <div className="p-4 max-h-64 overflow-y-auto space-y-2 bg-slate-900/90 text-xs">
            {logs.length === 0 ? (
              <div className="text-center py-4 text-slate-500 font-mono">
                No node execution logs available yet...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.node_id}
                  onClick={() => setSelectedLog(selectedLog?.node_id === log.node_id ? null : log)}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          log.status === 'success'
                            ? 'bg-emerald-500'
                            : log.status === 'failed'
                            ? 'bg-rose-500'
                            : log.status === 'running'
                            ? 'bg-cyan-500 animate-ping'
                            : 'bg-slate-600'
                        }`}
                      />
                      <span className="font-mono font-semibold text-slate-200">{log.node_id}</span>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        log.status === 'success'
                          ? 'text-emerald-400 bg-emerald-950/50'
                          : log.status === 'failed'
                          ? 'text-rose-400 bg-rose-950/50'
                          : 'text-slate-400 bg-slate-800'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>

                  {log.error && (
                    <div className="text-[11px] text-rose-300 font-mono bg-rose-950/50 p-1.5 rounded border border-rose-900/50">
                      {log.error}
                    </div>
                  )}

                  {selectedLog?.node_id === log.node_id && log.output && (
                    <pre className="p-2 bg-slate-950 rounded text-[10px] font-mono text-emerald-300 overflow-x-auto border border-slate-800">
                      {JSON.stringify(log.output, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

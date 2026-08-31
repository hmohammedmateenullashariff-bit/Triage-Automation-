import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Terminal,
  Zap,
  Globe,
} from 'lucide-react';
import type { ExecutionRunSummary, ExecutionRun, NodeExecutionLog } from '../../api/types';
import { listWorkflowRuns, getRun } from '../../api/workflows';

interface RunHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: string;
  workflowName: string;
}

export const RunHistoryModal: React.FC<RunHistoryModalProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowName,
}) => {
  const [runs, setRuns] = useState<ExecutionRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected run for drill-down inspection
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<ExecutionRun | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedLogNodeId, setSelectedLogNodeId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkflowRuns(workflowId, 50, 0);
      setRuns(res.runs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load execution run history');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  const loadRunDetails = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetails(true);
    try {
      const details = await getRun(runId);
      setSelectedRunDetails(details);
    } catch (err: any) {
      setError(err.message || 'Failed to load run details');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedRunId(null);
      setSelectedRunDetails(null);
      setSelectedLogNodeId(null);
      fetchRuns();
    }
  }, [isOpen, fetchRuns]);

  if (!isOpen) return null;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800/80 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Running</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-950/50">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  {selectedRunId ? 'Run Execution Details' : 'Execution Run History'}
                </h2>
                <span className="text-[11px] font-mono text-slate-400 max-w-[200px] truncate">
                  • {workflowName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {selectedRunId
                  ? 'Per-node execution timeline and payload logs'
                  : 'Historical record of previous workflow executions and pass/fail metrics'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!selectedRunId && (
              <button
                onClick={fetchRuns}
                disabled={loading}
                title="Refresh history"
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {selectedRunId ? (
            /* Drill-Down Details View */
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedRunId(null);
                  setSelectedRunDetails(null);
                }}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Run History</span>
              </button>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Loading execution logs...</span>
                </div>
              ) : selectedRunDetails ? (
                <div className="space-y-4">
                  {/* Summary Card */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(selectedRunDetails.status)}
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {selectedRunDetails.run_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Started: {new Date(selectedRunDetails.started_at).toLocaleString()}
                        {selectedRunDetails.finished_at && (
                          <span> • Finished: {new Date(selectedRunDetails.finished_at).toLocaleString()}</span>
                        )}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <span className="text-slate-400">Total Nodes: </span>
                      <span className="font-bold text-slate-200">
                        {selectedRunDetails.node_logs?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Trigger Payload Preview */}
                  {selectedRunDetails.trigger_payload && Object.keys(selectedRunDetails.trigger_payload).length > 0 && (
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Trigger Payload</span>
                      </div>
                      <pre className="text-[10px] font-mono text-cyan-300 bg-slate-950 p-2 rounded overflow-x-auto max-h-32 border border-slate-800">
                        {JSON.stringify(selectedRunDetails.trigger_payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Node Logs Timeline */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-300">
                      Node Execution Timeline ({selectedRunDetails.node_logs?.length || 0})
                    </h3>

                    <div className="space-y-2">
                      {(selectedRunDetails.node_logs || []).map((log: NodeExecutionLog, index: number) => {
                        const isExpanded = selectedLogNodeId === log.node_id;
                        return (
                          <div
                            key={log.node_id || index}
                            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2 hover:border-slate-700 transition-colors"
                          >
                            <div
                              onClick={() => setSelectedLogNodeId(isExpanded ? null : log.node_id)}
                              className="flex items-center justify-between cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                                  {index + 1}
                                </span>
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    log.status === 'success'
                                      ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                                      : log.status === 'failed'
                                      ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                                      : log.status === 'running'
                                      ? 'bg-cyan-400 animate-ping'
                                      : 'bg-slate-600'
                                  }`}
                                />
                                <span className="text-xs font-mono font-bold text-slate-100">
                                  {log.node_id}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                {renderStatusBadge(log.status)}
                                <span className="text-xs text-slate-500 font-mono">
                                  {isExpanded ? '▲ Hide Output' : '▼ View Output'}
                                </span>
                              </div>
                            </div>

                            {log.error && (
                              <div className="text-xs text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-900/60 font-mono">
                                ❌ {log.error}
                              </div>
                            )}

                            {isExpanded && log.output && (
                              <div className="pt-1">
                                <div className="text-[10px] font-mono text-slate-400 mb-1">
                                  Node Output Data:
                                </div>
                                <pre className="p-2.5 bg-slate-950 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-48 border border-slate-800">
                                  {JSON.stringify(log.output, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Runs List Table View */
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Loading execution history...</span>
                </div>
              ) : error ? (
                <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60">
                  {error}
                </div>
              ) : !workflowId ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  Save this workflow first to record and view execution run history.
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30 space-y-2">
                  <History className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-300">No execution runs recorded yet.</p>
                  <p className="text-[11px] text-slate-500">
                    Click "Run Workflow" or trigger a webhook to execute this workflow.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {runs.map((run) => (
                    <div
                      key={run.run_id}
                      onClick={() => loadRunDetails(run.run_id)}
                      className="p-4 flex items-center justify-between hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          {renderStatusBadge(run.status)}
                          <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                            {run.run_id}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              run.trigger_type === 'webhook'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {run.trigger_type === 'webhook' ? (
                              <Globe className="w-3 h-3" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            <span className="uppercase">{run.trigger_type}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                          <span>{new Date(run.started_at).toLocaleString()}</span>
                          {run.duration_seconds !== null && run.duration_seconds !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{run.duration_seconds}s</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-emerald-400">{run.node_counts.success} pass</span>
                          {run.node_counts.failed > 0 && (
                            <span className="text-rose-400">{run.node_counts.failed} fail</span>
                          )}
                          {run.node_counts.skipped > 0 && (
                            <span className="text-slate-500">{run.node_counts.skipped} skip</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-slate-500 group-hover:text-indigo-400 transition-colors">
                        <span className="text-xs font-semibold">Inspect</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>{runs.length} historical runs stored in Supabase</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

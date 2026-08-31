import { useState, useEffect } from 'react';
import {
  Plus,
  Layers,
  Search,
  Loader2,
  ExternalLink,
  Zap,
  Globe,
  Sparkles,
  GitBranch,
  Shield,
} from 'lucide-react';
import type { WorkflowSummary } from '../../api/types';
import { listWorkflows } from '../../api/workflows';
import { CredentialModal } from '../credentials/CredentialModal';

interface WorkflowListViewProps {
  onSelectWorkflow: (workflow: WorkflowSummary) => void;
  onNewWorkflow: () => void;
}

export const WorkflowListView: React.FC<WorkflowListViewProps> = ({
  onSelectWorkflow,
  onNewWorkflow,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCredModal, setShowCredModal] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkflows(50, 0);
      setWorkflows(res.workflows || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col font-sans">
      {/* Header */}
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Workflow Automation Engine</h1>
              <p className="text-xs text-slate-400">
                Self-hosted DAG execution engine & visual workflow builder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCredModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 shadow-md transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Credentials</span>
            </button>

            <button
              onClick={onNewWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Workflow</span>
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={fetchWorkflows}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400 font-mono">Fetching workflows from Supabase...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">No workflows found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Create a new DAG workflow to orchestrate HTTP requests, LLM models, custom Python code, and conditional branching.
              </p>
            </div>
            <button
              onClick={onNewWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Workflow</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((w) => (
              <div
                key={w.workflow_id}
                onClick={() => onSelectWorkflow(w)}
                className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                      {w.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      v{w.version}
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-500 truncate mb-4">
                    {w.workflow_id}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {w.nodes.slice(0, 4).map((node, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1"
                      >
                        {node.type === 'http_request' && <Globe className="w-3 h-3 text-sky-400" />}
                        {node.type === 'llm' && <Sparkles className="w-3 h-3 text-emerald-400" />}
                        {node.type === 'conditional' && <GitBranch className="w-3 h-3 text-amber-400" />}
                        <span>{node.name}</span>
                      </span>
                    ))}
                    {w.nodes.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        +{w.nodes.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>{w.nodes.length} Nodes, {w.edges.length} Edges</span>
                  </div>

                  <div className="flex items-center gap-1 text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Open Canvas</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CredentialModal
        isOpen={showCredModal}
        onClose={() => setShowCredModal(false)}
      />
    </div>
  );
};

import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { CustomNode } from '../../utils/serialization';
import type { OnErrorPolicy, NodeType } from '../../api/types';
import { HttpConfigForm } from './HttpConfigForm';
import { CondConfigForm } from './CondConfigForm';
import { CodeConfigForm } from './CodeConfigForm';
import { DelayConfigForm } from './DelayConfigForm';
import { LlmConfigForm } from './LlmConfigForm';
import { ErrorPolicyForm } from './ErrorPolicyForm';

interface NodeConfigDrawerProps {
  selectedNode: CustomNode | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<CustomNode['data']>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  selectedNode,
  onClose,
  onUpdateNode,
  onDeleteNode,
}) => {
  if (!selectedNode) return null;

  const { id, data } = selectedNode;
  const nodeType = (selectedNode.type as NodeType) || data.type || 'http_request';

  const handleNameChange = (name: string) => {
    onUpdateNode(id, { name });
  };

  const handleConfigChange = (config: Record<string, any>) => {
    onUpdateNode(id, { config });
  };

  const handleErrorPolicyChange = (onError: OnErrorPolicy, retryCount: number) => {
    onUpdateNode(id, { on_error: onError, retry_count: retryCount });
  };

  const renderTypeForm = () => {
    switch (nodeType) {
      case 'http_request':
        return (
          <HttpConfigForm
            config={data.config as any}
            onChange={handleConfigChange}
          />
        );
      case 'conditional':
        return (
          <CondConfigForm
            config={data.config as any}
            onChange={handleConfigChange}
          />
        );
      case 'code':
        return (
          <CodeConfigForm
            config={data.config as any}
            onChange={handleConfigChange}
          />
        );
      case 'delay':
        return (
          <DelayConfigForm
            config={data.config as any}
            onChange={handleConfigChange}
          />
        );
      case 'llm':
        return (
          <LlmConfigForm
            config={data.config as any}
            onChange={handleConfigChange}
          />
        );
      default:
        return (
          <div className="text-xs text-slate-400">
            No specific configuration required for this node type.
          </div>
        );
    }
  };

  return (
    <div className="fixed top-14 right-0 bottom-0 w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Node Configuration</h2>
            <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
              {nodeType}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{id}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDeleteNode(id)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Node Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Display Label
          </label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Node display name"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Type-specific Form */}
        <div className="pt-2">
          {renderTypeForm()}
        </div>

        {/* Error Policy */}
        <ErrorPolicyForm
          onError={data.on_error || 'fail'}
          retryCount={data.retry_count || 0}
          onChange={handleErrorPolicyChange}
        />
      </div>
    </div>
  );
};

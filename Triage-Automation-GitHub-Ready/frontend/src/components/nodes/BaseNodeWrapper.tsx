import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  Trash2,
} from 'lucide-react';
import type { WorkflowNodeData } from '../../utils/serialization';

interface BaseNodeWrapperProps {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
  icon: React.ReactNode;
  accentColor: string;
  badgeText: string;
  children?: React.ReactNode;
  hideDefaultOutputHandle?: boolean;
  onDelete?: (id: string) => void;
}

export const BaseNodeWrapper: React.FC<BaseNodeWrapperProps> = ({
  id,
  data,
  selected,
  icon,
  accentColor,
  badgeText,
  children,
  hideDefaultOutputHandle = false,
  onDelete,
}) => {
  const status = data.status;

  const getStatusBorder = () => {
    switch (status) {
      case 'running':
        return 'ring-2 ring-cyan-400 border-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.4)]';
      case 'success':
        return 'ring-2 ring-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
      case 'failed':
        return 'ring-2 ring-rose-500 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]';
      case 'skipped':
        return 'border-dashed border-slate-600 opacity-60';
      default:
        return selected ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-slate-800 hover:border-slate-700';
    }
  };

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl bg-slate-900/90 backdrop-blur-md border text-slate-100 p-3 shadow-xl transition-all duration-200 ${getStatusBorder()}`}
    >
      {/* Target handle (Input) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 hover:!bg-indigo-400 !border-2 !border-slate-900 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 shadow-sm"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-200 truncate leading-tight">
              {data.name || data.node_id}
            </span>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {data.node_id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status Indicator */}
          {status === 'running' && (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          {status === 'failed' && (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          {status === 'skipped' && (
            <MinusCircle className="w-4 h-4 text-slate-500" />
          )}
          {!status && (
            <span
              className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
                borderColor: `${accentColor}30`,
              }}
            >
              {badgeText}
            </span>
          )}

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
              title="Delete node"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="pt-2 text-xs text-slate-300 space-y-1">
        {children}

        {/* Error notification if node failed */}
        {status === 'failed' && data.error && (
          <div className="mt-2 p-1.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[11px] font-mono break-words">
            {data.error}
          </div>
        )}

        {/* Policy tags */}
        {data.on_error && data.on_error !== 'fail' && (
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/50 text-amber-400 border border-amber-800/40">
              on_error: {data.on_error}
              {data.on_error === 'retry' ? ` (${data.retry_count}x)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Default Source Handle (Output) */}
      {!hideDefaultOutputHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-slate-400 hover:!bg-indigo-400 !border-2 !border-slate-900 transition-colors"
        />
      )}
    </div>
  );
};

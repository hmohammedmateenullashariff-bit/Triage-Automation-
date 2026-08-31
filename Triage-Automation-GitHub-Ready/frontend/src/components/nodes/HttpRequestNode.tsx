import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import type { WorkflowNodeData } from '../../utils/serialization';

export const HttpRequestNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const config = nodeData.config || {};
  const method = config.method || 'GET';
  const url = config.url || 'https://api.example.com';

  const methodColors: Record<string, string> = {
    GET: 'text-sky-400 bg-sky-950/60 border-sky-800',
    POST: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    PUT: 'text-amber-400 bg-amber-950/60 border-amber-800',
    DELETE: 'text-rose-400 bg-rose-950/60 border-rose-800',
    PATCH: 'text-purple-400 bg-purple-950/60 border-purple-800',
  };

  return (
    <BaseNodeWrapper
      id={id}
      data={nodeData}
      selected={selected}
      icon={<Globe className="w-4 h-4" />}
      accentColor="#38bdf8"
      badgeText="HTTP"
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] overflow-hidden">
        <span
          className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
            methodColors[method] || methodColors.GET
          }`}
        >
          {method}
        </span>
        <span className="truncate text-slate-400" title={url}>
          {url}
        </span>
      </div>
    </BaseNodeWrapper>
  );
};

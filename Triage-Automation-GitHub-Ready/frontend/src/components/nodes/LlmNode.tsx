import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import type { WorkflowNodeData } from '../../utils/serialization';

export const LlmNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const config = nodeData.config || {};
  const prompt = config.prompt || 'Ask AI a question...';
  const model = config.model || 'claude-3-5-haiku-20241022';

  return (
    <BaseNodeWrapper
      id={id}
      data={nodeData}
      selected={selected}
      icon={<Sparkles className="w-4 h-4" />}
      accentColor="#10b981"
      badgeText="AI"
    >
      <div className="bg-slate-950/60 border border-slate-800 rounded p-1.5 font-mono text-[11px] text-emerald-300/90 truncate" title={prompt}>
        {prompt}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span className="truncate max-w-[140px]">{model.split('-').slice(0, 3).join('-')}</span>
        <span>max {config.max_tokens || 1024} tok</span>
      </div>
    </BaseNodeWrapper>
  );
};

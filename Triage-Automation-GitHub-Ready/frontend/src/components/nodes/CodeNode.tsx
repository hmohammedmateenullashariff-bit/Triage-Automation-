import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import type { WorkflowNodeData } from '../../utils/serialization';

export const CodeNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const config = nodeData.config || {};
  const code = config.code || 'result = {}';
  const firstLine = code.split('\n').find((l: string) => l.trim().length > 0) || 'result = {}';

  return (
    <BaseNodeWrapper
      id={id}
      data={nodeData}
      selected={selected}
      icon={<Terminal className="w-4 h-4" />}
      accentColor="#a855f7"
      badgeText="PYTHON"
    >
      <div className="bg-slate-950/70 border border-slate-800 rounded p-1.5 font-mono text-[11px] text-purple-300 truncate" title={code}>
        <code>{firstLine}</code>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Subprocess Sandbox</span>
        <span>{config.timeout_seconds || 10}s</span>
      </div>
    </BaseNodeWrapper>
  );
};

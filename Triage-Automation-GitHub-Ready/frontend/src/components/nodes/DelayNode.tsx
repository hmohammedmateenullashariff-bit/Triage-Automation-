import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import type { WorkflowNodeData } from '../../utils/serialization';

export const DelayNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const config = nodeData.config || {};
  const duration = config.duration_seconds !== undefined ? config.duration_seconds : 1;

  return (
    <BaseNodeWrapper
      id={id}
      data={nodeData}
      selected={selected}
      icon={<Clock className="w-4 h-4" />}
      accentColor="#94a3b8"
      badgeText="SLEEP"
    >
      <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded p-1.5 text-[11px] text-slate-300">
        <span>Duration:</span>
        <span className="font-mono font-bold text-slate-200">{duration} seconds</span>
      </div>
    </BaseNodeWrapper>
  );
};

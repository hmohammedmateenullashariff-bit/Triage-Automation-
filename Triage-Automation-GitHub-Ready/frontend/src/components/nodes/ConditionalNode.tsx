import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import type { WorkflowNodeData } from '../../utils/serialization';

export const ConditionalNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const config = nodeData.config || {};
  const condition = config.condition || '{{trigger.value}} == true';

  return (
    <div className="relative">
      <BaseNodeWrapper
        id={id}
        data={nodeData}
        selected={selected}
        icon={<GitBranch className="w-4 h-4" />}
        accentColor="#f59e0b"
        badgeText="IF"
        hideDefaultOutputHandle={true}
      >
        <div className="bg-slate-950/60 border border-slate-800 rounded p-1.5 font-mono text-[11px] text-amber-300/90 truncate" title={condition}>
          {condition}
        </div>

        {/* Dual Branch Output Handles Container */}
        <div className="flex flex-col gap-3 pt-2 text-[10px] font-semibold text-right pr-1">
          <div className="flex items-center justify-end gap-1.5 text-emerald-400">
            <span>True Branch</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center justify-end gap-1.5 text-rose-400">
            <span>False Branch</span>
            <div className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      </BaseNodeWrapper>

      {/* True Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '65%', right: '-6px' }}
        className="!w-3 !h-3 !bg-emerald-500 hover:!bg-emerald-400 !border-2 !border-slate-900 transition-colors"
      />

      {/* False Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '88%', right: '-6px' }}
        className="!w-3 !h-3 !bg-rose-500 hover:!bg-rose-400 !border-2 !border-slate-900 transition-colors"
      />
    </div>
  );
};

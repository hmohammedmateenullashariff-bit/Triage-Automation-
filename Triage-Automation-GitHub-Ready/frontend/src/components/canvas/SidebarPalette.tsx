import React from 'react';
import {
  Globe,
  GitBranch,
  Terminal,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import type { NodeType } from '../../api/types';

interface NodeTypeItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  badge: string;
}

const PALETTE_ITEMS: NodeTypeItem[] = [
  {
    type: 'http_request',
    label: 'HTTP Request',
    description: 'Fetch, post, or webhook outbound REST calls',
    icon: <Globe className="w-4 h-4" />,
    accentColor: '#38bdf8',
    badge: 'Network',
  },
  {
    type: 'conditional',
    label: 'Conditional IF',
    description: 'Branch DAG execution (True / False paths)',
    icon: <GitBranch className="w-4 h-4" />,
    accentColor: '#f59e0b',
    badge: 'Logic',
  },
  {
    type: 'code',
    label: 'Python Code',
    description: 'Execute sandboxed Python script with input_data',
    icon: <Terminal className="w-4 h-4" />,
    accentColor: '#a855f7',
    badge: 'Compute',
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Sequential sleep timer before next step',
    icon: <Clock className="w-4 h-4" />,
    accentColor: '#94a3b8',
    badge: 'Utility',
  },
  {
    type: 'llm',
    label: 'LLM AI Assistant',
    description: 'Prompt Claude mid-workflow for AI reasoning',
    icon: <Sparkles className="w-4 h-4" />,
    accentColor: '#10b981',
    badge: 'AI',
  },
];

export const SidebarPalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-72 bg-slate-900/90 backdrop-blur-md border-r border-slate-800 flex flex-col z-10 select-none">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Node Palette
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Drag and drop onto canvas to build DAG
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            onDragStart={(e) => onDragStart(e, item.type)}
            draggable
            className="group relative p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-lg shadow-inner"
                  style={{
                    backgroundColor: `${item.accentColor}20`,
                    color: item.accentColor,
                  }}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {item.label}
                </span>
              </div>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: `${item.accentColor}10`,
                  color: item.accentColor,
                  borderColor: `${item.accentColor}30`,
                }}
              >
                {item.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <span>
          Connect nodes to define execution order. Branch skipping applies to Conditional IF nodes.
        </span>
      </div>
    </div>
  );
};

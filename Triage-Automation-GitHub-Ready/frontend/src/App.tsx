import { useState } from 'react';
import { WorkflowListView } from './components/views/WorkflowListView';
import { WorkflowCanvas } from './components/canvas/WorkflowCanvas';
import type { WorkflowSummary, WorkflowDefinition } from './api/types';

export function App() {
  const [currentView, setCurrentView] = useState<'list' | 'canvas'>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);

  const handleSelectWorkflow = (workflow: WorkflowSummary) => {
    setSelectedWorkflow(workflow);
    setCurrentView('canvas');
  };

  const handleNewWorkflow = () => {
    setSelectedWorkflow(null);
    setCurrentView('canvas');
  };

  const handleBackToList = () => {
    setSelectedWorkflow(null);
    setCurrentView('list');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {currentView === 'list' ? (
        <WorkflowListView
          onSelectWorkflow={handleSelectWorkflow}
          onNewWorkflow={handleNewWorkflow}
        />
      ) : (
        <WorkflowCanvas
          initialWorkflow={selectedWorkflow}
          onBackToList={handleBackToList}
        />
      )}
    </div>
  );
}

export default App;

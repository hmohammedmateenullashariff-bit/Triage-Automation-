import { useState } from 'react';
import {
  Play,
  Save,
  ArrowLeft,
  KeyRound,
  Check,
  SlidersHorizontal,
  Loader2,
  Shield,
  History,
  Globe,
} from 'lucide-react';
import { getApiKey, setApiKey } from '../../api/client';
import { CredentialModal } from '../credentials/CredentialModal';
import { RunHistoryModal } from '../history/RunHistoryModal';
import { WebhookTriggerModal } from '../webhook/WebhookTriggerModal';
import type { TriggerConfig } from '../../api/types';

interface CanvasHeaderProps {
  workflowId?: string;
  workflowName: string;
  triggerConfig: TriggerConfig;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onRunClick: () => void;
  onBackToList: () => void;
  onTriggerUpdated: (trigger: TriggerConfig) => void;
  isSaving: boolean;
  isRunning: boolean;
  hasUnsavedChanges?: boolean;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  workflowId,
  workflowName,
  triggerConfig,
  onNameChange,
  onSave,
  onRunClick,
  onBackToList,
  onTriggerUpdated,
  isSaving,
  isRunning,
  hasUnsavedChanges = false,
}) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showCredModal, setShowCredModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [apiKeyVal, setApiKeyVal] = useState(getApiKey());
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  const handleSaveKey = () => {
    setApiKey(apiKeyVal.trim());
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowKeyModal(false);
    }, 800);
  };

  const isWebhook = triggerConfig.type === 'webhook';

  return (
    <>
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between z-20 select-none">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Back to workflow list"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workflows</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => onNameChange(e.target.value)}
              className="bg-transparent hover:bg-slate-800/50 focus:bg-slate-950 px-2 py-1 rounded-md text-sm font-semibold text-slate-100 border border-transparent focus:border-indigo-500 focus:outline-none transition-colors w-64 truncate"
              placeholder="Workflow Name"
            />
            {hasUnsavedChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Trigger Settings Modal Button */}
          <button
            onClick={() => setShowWebhookModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isWebhook
                ? 'bg-purple-950/60 hover:bg-purple-900/60 border-purple-800 text-purple-300'
                : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Configure Trigger Mode (Manual vs Inbound Webhook)"
          >
            <Globe className={`w-3.5 h-3.5 ${isWebhook ? 'text-purple-400' : 'text-slate-400'}`} />
            <span>{isWebhook ? 'Trigger: Webhook' : 'Trigger'}</span>
          </button>

          {/* Execution History Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:text-white transition-colors cursor-pointer"
            title="View Past Execution Runs & Logs"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>History</span>
          </button>

          {/* Credentials Manager Modal Button */}
          <button
            onClick={() => setShowCredModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:text-white transition-colors cursor-pointer"
            title="Manage Encrypted Credentials"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Credentials</span>
          </button>

          {/* API Key Modal Button */}
          <button
            onClick={() => setShowKeyModal(true)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Configure API Key (X-API-Key)"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Manual Trigger Payload Config Button */}
          <button
            onClick={onRunClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:text-white transition-colors cursor-pointer"
            title="Configure Manual Trigger Payload"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Payload</span>
          </button>

          {/* Save Button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-200 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Run Button */}
          <button
            onClick={onRunClick}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'Running...' : 'Run Workflow'}</span>
          </button>
        </div>
      </header>

      {/* History Modal */}
      <RunHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        workflowId={workflowId}
        workflowName={workflowName}
      />

      {/* Webhook Trigger Modal */}
      <WebhookTriggerModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        workflowId={workflowId}
        workflowName={workflowName}
        triggerConfig={triggerConfig}
        onTriggerUpdated={onTriggerUpdated}
      />

      {/* Credential Store Modal */}
      <CredentialModal
        isOpen={showCredModal}
        onClose={() => setShowCredModal(false)}
      />

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Authentication (X-API-Key)</span>
            </div>
            <p className="text-xs text-slate-400">
              Attached to all HTTP requests sent to the backend workflow engine.
            </p>
            <input
              type="password"
              value={apiKeyVal}
              onChange={(e) => setApiKeyVal(e.target.value)}
              placeholder="dev-api-key"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {savedKeySuccess ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{savedKeySuccess ? 'Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

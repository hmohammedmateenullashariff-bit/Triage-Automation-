import React, { useState, useEffect } from 'react';
import {
  Globe,
  Zap,
  Lock,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  X,
  Trash2,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import type { TriggerConfig, WebhookConfigResponse } from '../../api/types';
import { configureWorkflowWebhook, revokeWorkflowWebhook, getWorkflow } from '../../api/workflows';

interface WebhookTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: string;
  workflowName: string;
  triggerConfig: TriggerConfig;
  onTriggerUpdated: (newTrigger: TriggerConfig) => void;
}

export const WebhookTriggerModal: React.FC<WebhookTriggerModalProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  triggerConfig,
  onTriggerUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Webhook details from backend
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState<boolean>(false);

  // Secret setup state
  const [secretInput, setSecretInput] = useState('');
  const [autoGenSecret, setAutoGenSecret] = useState(true);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const isWebhookActive = triggerConfig.type === 'webhook';

  const loadWorkflowWebhookStatus = async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const wf = await getWorkflow(workflowId);
      if (wf.trigger.type === 'webhook') {
        const token = wf.webhook_token || wf.trigger.config?.webhook_token;
        if (token) {
          const fullUrl = `${window.location.origin}/webhooks/${token}`;
          setWebhookUrl(fullUrl);
        }
        setHasSecret(Boolean(wf.has_secret || wf.trigger.config?.has_secret));
      } else {
        setWebhookUrl(null);
        setHasSecret(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check webhook status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setOneTimeSecret(null);
      setCopiedUrl(false);
      setCopiedSecret(false);
      loadWorkflowWebhookStatus();
    }
  }, [isOpen, workflowId]);

  const handleEnableWebhook = async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = autoGenSecret
        ? { generate_secret: true }
        : secretInput.trim()
        ? { secret: secretInput.trim() }
        : {};

      const res: WebhookConfigResponse = await configureWorkflowWebhook(workflowId, payload);
      const fullUrl = `${window.location.origin}${res.webhook_url}`;
      setWebhookUrl(fullUrl);
      setHasSecret(res.has_secret);

      if (res.secret) {
        setOneTimeSecret(res.secret);
      }

      onTriggerUpdated({
        type: 'webhook',
        config: {
          webhook_token: res.webhook_token,
          has_secret: res.has_secret,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to configure webhook trigger');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeWebhook = async () => {
    if (!workflowId) return;
    if (
      !window.confirm(
        'Are you sure you want to revoke this webhook? External integrations calling this endpoint will immediately receive 404 errors.'
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await revokeWorkflowWebhook(workflowId);
      setWebhookUrl(null);
      setHasSecret(false);
      setOneTimeSecret(null);
      onTriggerUpdated({
        type: 'manual',
        config: {},
      });
    } catch (err: any) {
      setError(err.message || 'Failed to revoke webhook');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1500);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-950/50">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Trigger Configuration
                <span
                  className={`text-[10px] font-mono font-normal px-2 py-0.5 rounded-full border ${
                    isWebhookActive
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {isWebhookActive ? 'WEBHOOK ACTIVE' : 'MANUAL TRIGGER'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure how <span className="font-semibold text-slate-200">{workflowName}</span> is triggered — manually or via external webhooks.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60 font-mono">
              {error}
            </div>
          )}

          {!workflowId ? (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              Please save the workflow first before configuring webhook triggers.
            </div>
          ) : isWebhookActive && webhookUrl ? (
            /* Active Webhook View */
            <div className="space-y-4">
              {/* Security Banner */}
              {hasSecret ? (
                <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-emerald-200">
                      HMAC-SHA256 Signature Verification Active
                    </span>
                    <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                      Inbound webhook requests must include the{' '}
                      <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300 font-mono">
                        X-Webhook-Signature
                      </code>{' '}
                      header computed as <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300 font-mono">sha256=HMAC_SHA256(secret, body)</code>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-amber-200">
                      Unauthenticated Public Webhook
                    </span>
                    <p className="text-[11px] text-amber-400/90 leading-relaxed">
                      This webhook has no secret configured. Anyone with the URL can trigger executions.
                    </p>
                  </div>
                </div>
              )}

              {/* One-Time Secret Alert */}
              {oneTimeSecret && (
                <div className="bg-purple-950/70 border border-purple-800 rounded-xl p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-200">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-purple-400" />
                      Generated Webhook Secret (One-Time Display)
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono bg-purple-900/60 px-2 py-0.5 rounded">
                      SAVE THIS NOW
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-300">
                    This secret will never be shown again. Use it to sign requests in your external service:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={oneTimeSecret}
                      className="w-full bg-slate-950 border border-purple-800/80 rounded-lg px-3 py-2 text-xs font-mono text-purple-200 select-all focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(oneTimeSecret, true)}
                      className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSecret ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Callable Webhook URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Public Webhook Endpoint URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl, false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* cURL Example */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>cURL Trigger Example</span>
                </div>
                <pre className="p-2.5 bg-slate-950 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-850">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json"${hasSecret ? ' \\\n  -H "X-Webhook-Signature: sha256=<HMAC_HEX>"' : ''} \\
  -d '{"event": "payment_completed", "amount": 100}'`}
                </pre>
              </div>

              {/* Revoke Action */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">
                  Returns HTTP 202 Accepted immediately on receipt
                </span>
                <button
                  onClick={handleRevokeWebhook}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Revoke Webhook</span>
                </button>
              </div>
            </div>
          ) : (
            /* Enable Webhook Form */
            <div className="space-y-4">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Switch to Inbound Webhook Trigger
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generating a webhook will create an unguessable endpoint that external systems (GitHub, Stripe, custom backends) can call to automatically execute this workflow DAG.
                </p>

                {/* Secret Options */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autogen"
                      checked={autoGenSecret}
                      onChange={(e) => setAutoGenSecret(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="autogen" className="text-xs text-slate-300 cursor-pointer">
                      Auto-generate a secure random HMAC secret (Recommended)
                    </label>
                  </div>

                  {!autoGenSecret && (
                    <div className="space-y-1 pt-1">
                      <label className="block text-[11px] text-slate-400">
                        Or enter a custom secret (leave blank for unauthenticated):
                      </label>
                      <input
                        type="password"
                        value={secretInput}
                        onChange={(e) => setSecretInput(e.target.value)}
                        placeholder="Leave blank or enter custom secret..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleEnableWebhook}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-950/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span>Enable Webhook Trigger</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Non-blocking execution with Fernet secret encryption</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

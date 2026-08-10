'use client';

/**
 * AcceptancePanel.tsx — Wave 99 + 110: Verifier Acceptance + OID4VP Presentation Request
 *
 * Tabs:
 * 1. Accept — Submit a presentation ID for full verification
 * 2. Request — Create an OID4VP presentation request and share with holder
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileSearch,
  Link2,
  Loader2,
  Send,
  Shield,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────

type ActiveTab = 'accept' | 'request';
type AcceptanceDecision = 'ACCEPTED' | 'REJECTED' | 'PENDING_REVIEW';

interface CredentialResult {
  credentialId: string;
  issuer: string;
  subject: string;
  valid: boolean;
  issuerTrustLevel?: string;
  checks: {
    signature: boolean;
    issuerTrusted: boolean;
    statusActive: boolean;
    notExpired: boolean;
  };
  errors: string[];
}

interface AcceptanceReport {
  reportId: string;
  presentationId: string;
  holder: string;
  credentialResults: CredentialResult[];
  decision: AcceptanceDecision;
  summary: string;
  evaluatedAt: string;
}

interface PresentationRequest {
  requestId: string;
  client_id: string;
  nonce: string;
  expiresAt: string;
  status: string;
  response_uri: string;
  presentation_definition: {
    id: string;
    name?: string;
    purpose?: string;
    input_descriptors: unknown[];
  };
  createdAt: string;
}

interface AcceptancePanelProps {
  className?: string;
  defaultPresentationId?: string;
}

// ── Decision styling ──────────────────────────────────────────────────

const DECISION_STYLE: Record<AcceptanceDecision, {
  icon: typeof CheckCircle2; border: string; bg: string; text: string; label: string;
}> = {
  ACCEPTED:       { icon: ShieldCheck, border: 'border-emerald-200', bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'Accepted'       },
  REJECTED:       { icon: ShieldX,     border: 'border-red-200',     bg: 'bg-red-50',      text: 'text-red-700',     label: 'Rejected'       },
  PENDING_REVIEW: { icon: Clock,       border: 'border-amber-200',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Pending Review' },
};

const TRUST_LEVEL_COLOR: Record<string, string> = {
  AUTHORITATIVE: 'text-emerald-600 bg-emerald-50',
  TRUSTED:       'text-blue-600 bg-blue-50',
  PROVISIONAL:   'text-amber-600 bg-amber-50',
  UNTRUSTED:     'text-red-600 bg-red-50',
};

// ── Component ─────────────────────────────────────────────────────────

export function AcceptancePanel({ className = '', defaultPresentationId = '' }: AcceptancePanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('accept');

  // Accept tab state
  const [presentationId, setPresentationId] = useState(defaultPresentationId);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AcceptanceReport | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Request tab state (Wave 110: OID4VP)
  const [verifierDid, setVerifierDid] = useState('did:vitalcv:verifier:my-hospital');
  const [requesting, setRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<PresentationRequest | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const base = getApiBase();

  // ── Accept handler ────────────────────────────────────────────────

  const handleEvaluate = useCallback(async () => {
    if (!presentationId.trim()) return;
    setLoading(true);
    setAcceptError(null);
    setReport(null);
    try {
      // Same-origin Next proxy (app/api/verifier/accept) — routes server-side so
      // the verifier's org-role reaches the backend guard from the verified Clerk
      // session (x-org-role), not a spoofable client header. Do NOT point this at
      // the backend directly.
      const r = await fetch('/api/verifier/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentationId: presentationId.trim() }),
      });
      const data = await r.json() as { report?: AcceptanceReport; error?: string };
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setReport(data.report!);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  }, [presentationId]);

  // ── OID4VP Request handler (Wave 110) ────────────────────────────

  const handleCreateRequest = useCallback(async () => {
    if (!verifierDid.trim()) return;
    setRequesting(true);
    setRequestError(null);
    setRequestResult(null);
    try {
      const r = await fetch(`${base}/api/oid4vp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifierDid: verifierDid.trim(), useMedicalTemplate: true }),
      });
      const data = await r.json() as PresentationRequest & { error?: string };
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setRequestResult(data);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Failed to create presentation request');
    } finally {
      setRequesting(false);
    }
  }, [base, verifierDid]);

  const copyResponseUri = useCallback(() => {
    if (!requestResult) return;
    void navigator.clipboard.writeText(requestResult.response_uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [requestResult]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className={`rounded-2xl border border-infra-border bg-white overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-infra-border bg-infra-surface">
        <ShieldCheck className="h-5 w-5 text-infra-blue" />
        <h2 className="font-bold text-foreground">Credential Verification</h2>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Wave 99 + 110
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-infra-border">
        {(['accept', 'request'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-infra-blue border-b-2 border-infra-blue bg-blue-50/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'accept' ? (
              <span className="flex items-center justify-center gap-1.5"><FileSearch className="h-3.5 w-3.5" />Evaluate</span>
            ) : (
              <span className="flex items-center justify-center gap-1.5"><Send className="h-3.5 w-3.5" />Request (OID4VP)</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* ── ACCEPT TAB ───────────────────────────────────────────── */}
        {activeTab === 'accept' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Presentation ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={presentationId}
                  onChange={(e) => setPresentationId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleEvaluate(); }}
                  placeholder="Enter presentation UUID or paste from clinician"
                  className="flex-1 rounded-xl border border-infra-border bg-infra-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-infra-blue/30"
                />
                <Button onClick={() => void handleEvaluate()} disabled={loading || !presentationId.trim()} className="gap-1.5">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Evaluating…</>
                    : <><ShieldCheck className="h-4 w-4" />Evaluate</>
                  }
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Clinicians generate presentations from VitalCV. Or use the Request tab to generate an OID4VP request first.
              </p>
            </div>

            {acceptError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-200">
                <XCircle className="h-4 w-4 flex-shrink-0" />{acceptError}
              </div>
            )}

            <AnimatePresence>
              {report && (
                <motion.div
                  key={report.reportId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {(() => {
                    const ds = DECISION_STYLE[report.decision];
                    const DIcon = ds.icon;
                    return (
                      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${ds.border} ${ds.bg}`}>
                        <DIcon className={`h-6 w-6 flex-shrink-0 ${ds.text}`} />
                        <div>
                          <p className={`font-bold text-base ${ds.text}`}>{ds.label}</p>
                          <p className={`text-xs mt-0.5 ${ds.text} opacity-80`}>{report.summary}</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-infra-surface px-3 py-2 border border-infra-border">
                      <p className="text-muted-foreground">Holder</p>
                      <p className="font-mono font-semibold mt-0.5">{report.holder}</p>
                    </div>
                    <div className="rounded-lg bg-infra-surface px-3 py-2 border border-infra-border">
                      <p className="text-muted-foreground">Evaluated</p>
                      <p className="font-semibold mt-0.5">{new Date(report.evaluatedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Credentials ({report.credentialResults.length})
                    </h3>
                    {report.credentialResults.map((cr) => (
                      <div
                        key={cr.credentialId}
                        className={`rounded-xl border p-3 space-y-2 ${cr.valid ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {cr.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                            <span className="text-xs font-mono">{cr.credentialId.slice(0, 12)}…</span>
                          </div>
                          {cr.issuerTrustLevel && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${TRUST_LEVEL_COLOR[cr.issuerTrustLevel] ?? 'text-muted-foreground bg-muted'}`}>
                              {cr.issuerTrustLevel}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-muted-foreground">Issuer: <span className="font-mono text-foreground">{cr.issuer.split(':').pop()}</span></span>
                          <span className="text-muted-foreground">Subject: <span className="font-mono text-foreground">{cr.subject}</span></span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(cr.checks).map(([check, passed]) => (
                            <div key={check} className="flex items-center gap-1.5 text-[10px]">
                              {passed ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertTriangle className="h-3 w-3 text-red-500" />}
                              <span className={passed ? 'text-emerald-700' : 'text-red-600'}>
                                {check.replace(/([A-Z])/g, ' $1').toLowerCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                        {cr.errors.length > 0 && (
                          <div className="space-y-0.5">
                            {cr.errors.map((e, i) => (
                              <p key={i} className="text-[10px] text-red-600 font-mono">✗ {e}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setReport(null); setPresentationId(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
                  >
                    Evaluate another presentation
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── REQUEST TAB (Wave 110: OID4VP) ───────────────────────── */}
        {activeTab === 'request' && (
          <>
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                <strong>OpenID4VP Presentation Request.</strong> Generate a standards-compliant presentation request.
                Share the response URI with the credential holder — they submit their credentials to it.
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Verifier DID
              </label>
              <input
                type="text"
                value={verifierDid}
                onChange={(e) => setVerifierDid(e.target.value)}
                placeholder="did:vitalcv:verifier:my-hospital"
                className="w-full rounded-xl border border-infra-border bg-infra-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-infra-blue/30"
              />
              <p className="text-xs text-muted-foreground">
                Uses the Medical Credential template (license + NPI). Expires in 10 minutes.
              </p>
            </div>

            <Button
              onClick={() => void handleCreateRequest()}
              disabled={requesting || !verifierDid.trim()}
              className="w-full gap-1.5"
            >
              {requesting
                ? <><Loader2 className="h-4 w-4 animate-spin" />Creating Request…</>
                : <><Send className="h-4 w-4" />Request Credential Presentation</>
              }
            </Button>

            {requestError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-200">
                <XCircle className="h-4 w-4 flex-shrink-0" />{requestError}
              </div>
            )}

            <AnimatePresence>
              {requestResult && (
                <motion.div
                  key={requestResult.requestId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-200 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Presentation request created — share the Response URI with the holder
                  </div>

                  {/* Request details */}
                  <div className="rounded-xl border border-infra-border bg-infra-surface divide-y divide-infra-border text-xs">
                    {[
                      { label: 'Request ID', value: requestResult.requestId },
                      { label: 'Nonce', value: requestResult.nonce.slice(0, 20) + '…' },
                      { label: 'Status', value: requestResult.status },
                      { label: 'Expires', value: new Date(requestResult.expiresAt).toLocaleString() },
                      { label: 'Definition', value: requestResult.presentation_definition.name ?? requestResult.presentation_definition.id },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center px-3 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Response URI */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />Response URI (share with holder)
                    </label>
                    <div className="flex gap-2 items-start">
                      <code className="flex-1 rounded-lg bg-slate-900 text-emerald-400 text-[10px] px-3 py-2 break-all font-mono">
                        {requestResult.response_uri}
                      </code>
                      <button
                        onClick={copyResponseUri}
                        className="flex-shrink-0 p-2 rounded-lg border border-infra-border bg-infra-surface hover:bg-muted transition-colors"
                        title="Copy URI"
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => { setRequestResult(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
                  >
                    Create another request
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

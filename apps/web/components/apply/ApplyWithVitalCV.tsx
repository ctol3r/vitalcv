'use client';

/**
 * ApplyWithVitalCV.tsx — Apply-with-VitalCV Widget
 *
 * Modal flow (3 steps):
 *   STEP 1 — credentials: trust state summary + selective disclosure toggles
 *   STEP 2 — org context: organization name, purpose of use, optional callback URL
 *   STEP 3 — confirmation: "Shared with [Org Name]" + timestamp + revoke button
 *
 * Backend: POST /api/apply/share (requires organization_context)
 * Revoke:  DELETE /api/apply/share/:shareId
 *
 * Mobile: bottom-sheet on small screens, centred modal on sm+.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface TrustStateData {
  readiness_level: string;
  readiness_score: number;
  readiness_status: string;
  computed_at: string;
}

interface TrustStateResponse {
  readiness_level?: string;
  readiness_score?: number;
  readiness_status?: string;
  computed_at?: string;
  facts?: Array<{ factType?: string; source: string; status: string; verifiedAt?: string; expiresAt?: string }>;
  credentials?: BundleCredential[];
}

interface ShareResult {
  success: boolean;
  shareId: string;
  bundleId: string;
  recipient: { organization_id: string; name: string };
  status: 'delivered' | 'email_fallback' | 'logged_only';
  sharedAt: string;
  expiresAt: string;
  bundleUrl: string;
  webhookDelivered: boolean;
  emailSent: boolean;
}

interface OrgContext {
  organization_id: string;
  name: string;
  callback_url: string;
  purpose_of_use: string;
}

type Step = 'credentials' | 'org_context' | 'confirmed';

interface Props {
  npi: string;
  label?: string;
  onShareComplete?: (result: ShareResult) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  'Credentialing review',
  'Locum tenens placement',
  'Employment consideration',
  'Privileging application',
  'Contract renewal',
  'Other',
] as const;

const LEVEL_COLORS: Record<string, string> = {
  L0: 'bg-red-500/20 text-red-300 ring-red-500/30',
  L1: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
  L2: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  L3: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400', verified: 'text-emerald-400', VERIFIED: 'text-emerald-400',
  pending: 'text-yellow-400', PENDING: 'text-yellow-400',
  UNVERIFIED: 'text-zinc-400', expired: 'text-red-400',
};

const STATUS_LABEL: Record<'delivered' | 'email_fallback' | 'logged_only', string> = {
  delivered: 'Delivered via webhook',
  email_fallback: 'Sent via email',
  logged_only: 'Logged — delivery pending',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function credentialTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEA_LICENSE: 'DEA License', STATE_LICENSE: 'State License',
    BOARD_CERT: 'Board Certification', NPI_IDENTITY: 'NPI Identity',
    NPPES_IDENTITY: 'NPPES Identity', OIG_EXCLUSION: 'OIG/LEIE Exclusion Check',
    EDUCATION: 'Education', MALPRACTICE: 'Malpractice Insurance',
    CANDIDATE_CREDENTIAL: 'Self-reported Credential', PSV_RESULT: 'Primary Source Verification',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

function clerkId(): string {
  return (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyWithVitalCV({ npi, label = 'Apply with VitalCV', onShareComplete }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [trustState, setTrustState] = useState<TrustStateData | null>(null);
  const [credentials, setCredentials] = useState<BundleCredential[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [orgCtx, setOrgCtx] = useState<OrgContext>({
    organization_id: '', name: '', callback_url: '', purpose_of_use: PURPOSE_OPTIONS[0],
  });
  const [orgCtxErrors, setOrgCtxErrors] = useState<Partial<Record<keyof OrgContext, string>>>({});
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open/close
  const openModal = useCallback(() => {
    setStep('credentials');
    setError(null);
    setShareResult(null);
    setOrgCtx({ organization_id: '', name: '', callback_url: '', purpose_of_use: PURPOSE_OPTIONS[0] });
    setOrgCtxErrors({});
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => { setIsOpen(false); }, []);

  // Fetch trust state
  useEffect(() => {
    if (!isOpen || trustState) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/trust-state/${npi}`)
      .then((r) => r.json())
      .then((data: TrustStateResponse) => {
        setTrustState({
          readiness_level: data.readiness_level ?? 'L0',
          readiness_score: data.readiness_score ?? 0,
          readiness_status: data.readiness_status ?? 'Unknown',
          computed_at: data.computed_at ?? new Date().toISOString(),
        });
        const creds: BundleCredential[] = data.credentials
          ?? (data.facts ?? []).map((f) => ({
            type: f.factType ?? f.source,
            issuer: f.source,
            status: f.status,
            verifiedAt: f.verifiedAt ?? null,
            expiresAt: f.expiresAt ?? null,
          }));
        setCredentials(creds);
        setSelectedTypes(new Set(creds.map((c) => c.type)));
      })
      .catch(() => setError('Trust engine connection interrupted. Please try again.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, npi, trustState]);

  // Countdown
  useEffect(() => {
    if (!shareResult) return;
    const tick = () => setCountdown(formatCountdown(shareResult.expiresAt));
    tick();
    countdownRef.current = setInterval(tick, 30_000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [shareResult]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [closeModal]);

  const toggleCredential = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  // Step 2 validation
  function validateOrgCtx(): boolean {
    const errs: Partial<Record<keyof OrgContext, string>> = {};
    if (!orgCtx.name.trim()) errs.name = 'Organization name is required.';
    if (!orgCtx.organization_id.trim()) errs.organization_id = 'Organization ID is required.';
    if (orgCtx.callback_url && !/^https?:\/\/.+/.test(orgCtx.callback_url)) {
      errs.callback_url = 'Must be a valid https:// URL.';
    }
    setOrgCtxErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Execute Share
  const handleShare = useCallback(async () => {
    if (!validateOrgCtx()) return;
    setIsSharing(true);
    setError(null);
    try {
      const id = clerkId();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (id) headers['x-clerk-user-id'] = id;

      const res = await fetch('/api/apply/share', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          npi,
          organization_context: {
            organization_id: orgCtx.organization_id.trim(),
            name: orgCtx.name.trim(),
            callback_url: orgCtx.callback_url.trim() || undefined,
            purpose_of_use: orgCtx.purpose_of_use,
          },
          selectiveClaims: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? 'Share failed. Please try again.');
      }

      const result = await res.json() as ShareResult;
      setShareResult(result);
      setStep('confirmed');
      onShareComplete?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share interrupted. Please try again.');
    } finally {
      setIsSharing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npi, orgCtx, selectedTypes, onShareComplete]);

  // Revoke
  const handleRevoke = useCallback(async () => {
    if (!shareResult?.shareId) return;
    setIsRevoking(true);
    try {
      const id = clerkId();
      const headers: Record<string, string> = {};
      if (id) headers['x-clerk-user-id'] = id;
      const res = await fetch(`/api/apply/share/${shareResult.shareId}`, {
        method: 'DELETE', headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? 'Revoke failed.');
      }
      // Show revoked state
      setShareResult((prev) => prev ? { ...prev, status: 'logged_only', webhookDelivered: false } : prev);
      setStep('credentials');
      setShareResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed.');
    } finally {
      setIsRevoking(false);
    }
  }, [shareResult]);

  const levelColor = trustState ? (LEVEL_COLORS[trustState.readiness_level] ?? LEVEL_COLORS.L0) : '';

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 font-semibold text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/50 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        aria-label={label}
      >
        <VCVIcon />
        {label}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col sm:items-center p-0 sm:p-4 justify-end sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Apply with VitalCV"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

      <div className="relative w-full max-w-lg mt-auto sm:mt-0 rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-zinc-900/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl backdrop-blur-xl overflow-hidden pointer-events-auto">

        {/* Mobile grabber */}
        <div className="absolute top-0 inset-x-0 flex justify-center py-2 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4 mt-2 sm:mt-0">
          <div className="flex items-center gap-2">
            <VCVIcon className="h-5 w-5" />
            <span className="text-sm font-semibold text-white">Apply with VitalCV</span>
            {/* Step indicator */}
            <div className="flex items-center gap-1 ml-2">
              {(['credentials', 'org_context', 'confirmed'] as Step[]).map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    step === s ? 'bg-emerald-400' :
                    (['credentials', 'org_context', 'confirmed'].indexOf(step) > i) ? 'bg-white/40' :
                    'bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/8 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">

          {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ── STEP 1: Credentials ── */}
          {!isLoading && step === 'credentials' && trustState && (
            <>
              {/* Trust state */}
              <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trust Readiness</p>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${levelColor}`}>
                    {trustState.readiness_level}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{trustState.readiness_status}</p>
                    <p className="text-xs text-zinc-500">Score: {trustState.readiness_score}/100</p>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${trustState.readiness_score}%` }}
                  />
                </div>
              </div>

              {/* Selective disclosure */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Credentials to Share ({selectedTypes.size} selected)
                </p>
                {credentials.length === 0 ? (
                  <p className="text-xs text-zinc-500">No verified credentials on file.</p>
                ) : (
                  <div className="space-y-2">
                    {credentials.map((cred) => (
                      <label
                        key={cred.type}
                        className="flex items-center min-h-[52px] gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 cursor-pointer hover:bg-white/6 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.has(cred.type)}
                          onChange={() => toggleCredential(cred.type)}
                          className="h-5 w-5 rounded border-white/20 bg-black/20 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{credentialTypeLabel(cred.type)}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{cred.issuer}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-black/20 ${STATUS_COLORS[cred.status] ?? 'text-zinc-400'}`}>
                          {cred.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-600">Bundle expires in 24 hours. Revocable at any time.</p>
            </>
          )}

          {/* ── STEP 2: Organization Context ── */}
          {step === 'org_context' && (
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Sharing with
              </p>

              {/* Org name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Organization name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={orgCtx.name}
                  onChange={(e) => setOrgCtx((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Stanford Health Care"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent"
                />
                {orgCtxErrors.name && <p className="mt-1 text-[10px] text-red-400">{orgCtxErrors.name}</p>}
              </div>

              {/* Org ID */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Organization ID <span className="text-red-400">*</span>
                  <span className="ml-1 text-[10px] text-zinc-600 font-normal">(system ID, NPI, or slug)</span>
                </label>
                <input
                  type="text"
                  value={orgCtx.organization_id}
                  onChange={(e) => setOrgCtx((p) => ({ ...p, organization_id: e.target.value }))}
                  placeholder="e.g. stanford-health-care or 1234567890"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {orgCtxErrors.organization_id && <p className="mt-1 text-[10px] text-red-400">{orgCtxErrors.organization_id}</p>}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Purpose of use <span className="text-red-400">*</span>
                </label>
                <select
                  value={orgCtx.purpose_of_use}
                  onChange={(e) => setOrgCtx((p) => ({ ...p, purpose_of_use: e.target.value }))}
                  className="w-full rounded-xl border border-white/12 bg-zinc-900 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {PURPOSE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Callback URL (optional) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Callback URL
                  <span className="ml-1 text-[10px] text-zinc-600 font-normal">(optional — webhook endpoint)</span>
                </label>
                <input
                  type="url"
                  value={orgCtx.callback_url}
                  onChange={(e) => setOrgCtx((p) => ({ ...p, callback_url: e.target.value }))}
                  placeholder="https://ehr.example.com/vcv-webhook"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {orgCtxErrors.callback_url && <p className="mt-1 text-[10px] text-red-400">{orgCtxErrors.callback_url}</p>}
              </div>

              <p className="text-[10px] text-zinc-600 leading-relaxed">
                This information is logged and audited. You can revoke access at any time.
              </p>
            </div>
          )}

          {/* ── STEP 3: Confirmed ── */}
          {step === 'confirmed' && shareResult && (
            <div className="space-y-4">
              {/* Shared with banner */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckIcon />
                  <p className="text-sm font-semibold text-emerald-400">
                    Shared with {shareResult.recipient.name}
                  </p>
                </div>
                <div className="space-y-1 text-xs text-zinc-400">
                  <p>
                    <span className="text-zinc-500">When:</span>{' '}
                    {new Date(shareResult.sharedAt).toLocaleString()}
                  </p>
                  <p>
                    <span className="text-zinc-500">Delivery:</span>{' '}
                    <span className={shareResult.webhookDelivered ? 'text-emerald-400' : 'text-zinc-400'}>
                      {STATUS_LABEL[shareResult.status]}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Expires:</span>{' '}
                    {countdown || formatCountdown(shareResult.expiresAt)}
                  </p>
                </div>
              </div>

              {/* Bundle URL */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Bundle link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 truncate font-mono">
                    {shareResult.bundleUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareResult.bundleUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-xs font-medium text-white hover:bg-white/12 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Credentials shared summary */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                  Credentials shared ({Array.from(selectedTypes).length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedTypes).map((type) => (
                    <span key={type} className="inline-flex text-[10px] font-medium bg-white/6 text-zinc-300 px-2 py-1 rounded-lg">
                      {credentialTypeLabel(type)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Revoke */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking…' : `Revoke access — ${shareResult.recipient.name}`}
                </button>
                <p className="mt-1.5 text-center text-[10px] text-zinc-600">
                  Revocation is immediate and permanent for this share.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        {!isLoading && !error && (
          <div className="border-t border-white/8 px-6 py-5 bg-black/20">
            {step === 'credentials' && (
              <button
                type="button"
                onClick={() => setStep('org_context')}
                disabled={selectedTypes.size === 0}
                className="w-full flex min-h-[52px] items-center justify-center rounded-xl bg-emerald-500 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Next: Share destination ({selectedTypes.size} credential{selectedTypes.size !== 1 ? 's' : ''}) →
              </button>
            )}

            {step === 'org_context' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-medium text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="flex-[3] flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSharing ? <><Spinner size="sm" /> Sharing…</> : 'Sign & Share'}
                </button>
              </div>
            )}

            {step === 'confirmed' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setShareResult(null);
                    setOrgCtx({ organization_id: '', name: '', callback_url: '', purpose_of_use: PURPOSE_OPTIONS[0] });
                  }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Share again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function VCVIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L3 7v11h14V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <svg className={`${size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'} animate-spin text-emerald-400`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default ApplyWithVitalCV;

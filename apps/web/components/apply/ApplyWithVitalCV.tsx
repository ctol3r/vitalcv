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
import { useBiometricConfirmation } from '@/hooks/useBiometricConfirmation';
import Link from 'next/link';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';

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
  /** Wave M — persisted reusable readiness snapshot issued with this share (null until backend migration deploys). */
  readinessSnapshotId?: string | null;
  readinessSnapshotPath?: string | null;
}

interface OrgContext {
  organization_id: string;
  name: string;
  callback_url: string;
  purpose_of_use: string;
}

/**
 * C3 — the canonical recipient, resolved from the selected opportunity.
 * When present, the clinician never types an internal organization id: the
 * recipient is shown as a fact and the backend re-resolves it from the
 * opportunity anyway, refusing any mismatch.
 */
export interface ApplicationRecipient {
  organizationId: string;
  organizationName: string;
  opportunityId: string;
  purposeOfUse?: string;
}

type Step = 'credentials' | 'org_context' | 'confirmed';

interface Props {
  npi: string;
  label?: string;
  /** Prefill the share destination (e.g. from a MATCHA opportunity's employer). Always editable. */
  initialOrgContext?: Partial<OrgContext>;
  onShareComplete?: (result: ShareResult) => void;
  /**
   * Wave 1072 — mirrors the clinician's ACTUAL selection so an embedding
   * surface (the employer-packet preview) can render exactly what would
   * travel. Fires on every selection change and on open.
   */
  onSelectionChange?: (selected: BundleCredential[]) => void;
  /** Fired when the share stops at the authentication boundary (backend 401). */
  onAuthRequired?: () => void;
  /**
   * C3 — recipient derived from the selected opportunity. Supplying it means
   * the org fields are read-only facts rather than inputs, and `opportunityId`
   * is sent so the backend can verify the organization↔opportunity link.
   */
  recipient?: ApplicationRecipient;
  /**
   * C4 — presentation only. 'career-loop' renders in the reset's ivory/ink/
   * indigo material system. The state machine, requests, selection logic,
   * auth boundary, a11y behaviour and revocation contract are IDENTICAL in
   * every appearance; only classes change. Default is unchanged for the
   * existing product surfaces.
   */
  appearance?: 'default' | 'career-loop';
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

/*
 * S1 — this component used to read `window.Clerk.user.id` here and send it as
 * `x-clerk-user-id` on the share/revoke calls, and the /api/apply/* proxies
 * forwarded that header verbatim to the backend. A browser header is an
 * assertion, not an identity: anything in the page could put another
 * clinician's Clerk id there. The proxies now derive identity server-side from
 * the Clerk session, so the header is both unnecessary and ignored — continuing
 * to send it would only advertise a channel that no longer exists.
 */

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyWithVitalCV({ npi, label = 'Apply with VitalCV', initialOrgContext, onShareComplete, onSelectionChange, onAuthRequired, recipient, appearance = 'default' }: Props) {
  /*
   * C4 — appearance is a CLASS MAP, nothing else. Every hook, request,
   * validation, keyboard path and aria attribute below is shared; only these
   * strings differ, so the career-loop skin cannot fork into a second Apply
   * implementation. The default strings are byte-identical to what shipped.
   */
  const careerLoop = appearance === 'career-loop';
  const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');
  const triggerCls = careerLoop
    ? 'inline-flex min-h-[56px] w-full sm:w-auto items-center justify-center gap-2 px-8 text-[17px] font-semibold text-white transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
    : 'inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 font-semibold text-foreground shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/50 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
  const panelCls = careerLoop
    // mobile keeps the bottom-sheet composition; ivory paper, ink edge, square
    ? 'relative w-full max-w-xl mt-auto sm:mt-0 border-t-[3px] sm:border-[3px] border-[color:var(--ink,#12100D)] bg-[color:var(--ivory,#F4F2ED)] text-[color:var(--ink,#12100D)] overflow-hidden pointer-events-auto'
    : 'relative w-full max-w-lg mt-auto sm:mt-0 rounded-t-3xl sm:rounded-2xl border-t sm:border border-border bg-zinc-900/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl backdrop-blur-xl overflow-hidden pointer-events-auto';
  const fieldCls = careerLoop
    ? 'w-full border-2 border-[color:var(--stone-deep,#B8B0A0)] bg-white px-4 py-3.5 text-[15px] text-[color:var(--ink-strong,#0E0D0B)] focus:outline-none focus:border-[color:var(--ink,#12100D)]'
    : 'w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent';
  const primaryCls = careerLoop
    ? 'min-h-[52px] px-7 text-[16px] font-semibold text-white transition-colors disabled:opacity-60'
    : 'min-h-[44px] rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-foreground transition hover:bg-emerald-400 disabled:opacity-60';
  const primaryStyle = careerLoop ? { background: 'var(--indigo, #3A30C4)' } : undefined;
  const triggerStyle = careerLoop ? { background: 'var(--ink, #12100D)' } : undefined;

  const baseOrgCtx = useCallback((): OrgContext => ({
    organization_id: recipient?.organizationId ?? initialOrgContext?.organization_id ?? '',
    name: recipient?.organizationName ?? initialOrgContext?.name ?? '',
    callback_url: initialOrgContext?.callback_url ?? '',
    purpose_of_use: recipient?.purposeOfUse ?? initialOrgContext?.purpose_of_use ?? PURPOSE_OPTIONS[0],
  }), [initialOrgContext, recipient]);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const { confirm: confirmBiometric, isConfirming, biometricError } = useBiometricConfirmation();
  const [trustState, setTrustState] = useState<TrustStateData | null>(null);
  const [credentials, setCredentials] = useState<BundleCredential[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [orgCtx, setOrgCtx] = useState<OrgContext>(baseOrgCtx);
  const [orgCtxErrors, setOrgCtxErrors] = useState<Partial<Record<keyof OrgContext, string>>>({});
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the backend refused for want of a verified session (C1/C7). */
  const [authRequired, setAuthRequired] = useState(false);
  /*
   * Wave 1075 — signed in, NPI claimed, ownership NOT yet verified. Distinct
   * from `authRequired`: the action needed is verification, not sign-in.
   */
  const [ownershipPending, setOwnershipPending] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open/close
  const openModal = useCallback(() => {
    setStep('credentials');
    setError(null);
    setShareResult(null);
    setOrgCtx(baseOrgCtx());
    setOrgCtxErrors({});
    setAuthRequired(false);
    setIsOpen(true);
    trackFunnelEvent(FUNNEL_EVENTS.APPLY_OPENED);
  }, [baseOrgCtx]);

  const closeModal = useCallback(() => { setIsOpen(false); }, []);

  // Fetch trust state
  useEffect(() => {
    if (!isOpen || trustState) return;
    setIsLoading(true);
    setError(null);
    /*
     * C1 — credential holdings come from the VERIFIED, NPI-bound route.
     * The anonymous trust-state endpoint (which the production homepage
     * capsule uses) would have handed a credential list to anyone who opened
     * this modal for any NPI. A 401 here is the honest boundary, not a
     * failure: the surface says what it cannot show and offers sign-in.
     */
    fetch(`/api/apply/credentials/${npi}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          setAuthRequired(true);
          /*
           * Wave 1075 — three states, not two. A 403 carrying
           * OWNERSHIP_PENDING means the clinician IS signed in and has asked
           * for this NPI, but nobody has verified that it is theirs. Telling
           * them to "sign in" would be wrong and telling them it "isn't
           * linked" would be misleading — they linked it; it is unproven.
           * The backend's own sentence is used verbatim so the boundary reads
           * the same everywhere.
           */
          let code: string | undefined;
          let message: string | undefined;
          try {
            const body = (await r.json()) as { code?: string; error?: string };
            code = body?.code;
            message = body?.error;
          } catch {
            // A non-JSON refusal is still a refusal.
          }
          if (r.status === 403 && code === 'OWNERSHIP_PENDING') {
            setOwnershipPending(true);
            setError(message ?? 'Verify this NPI before selecting and sharing private information.');
          } else {
            setError(r.status === 403
              ? (message ?? 'This NPI is not linked to your account.')
              : 'Sign in to see and choose what you share.');
          }
          return null;
        }
        return r.json();
      })
      .then((payload: { trustState?: TrustStateResponse; credentials?: BundleCredential[] } | null) => {
        if (!payload) return;
        const data = (payload.trustState ?? {}) as TrustStateResponse;
        setTrustState({
          readiness_level: data.readiness_level ?? 'L0',
          readiness_score: data.readiness_score ?? 0,
          readiness_status: data.readiness_status ?? 'Unknown',
          computed_at: data.computed_at ?? new Date().toISOString(),
        });
        const creds: BundleCredential[] = payload.credentials
          ?? data.credentials
          ?? (data.facts ?? []).map((f) => ({
            type: f.factType ?? f.source,
            issuer: f.source,
            status: f.status,
            verifiedAt: f.verifiedAt ?? null,
            expiresAt: f.expiresAt ?? null,
          }));
        setCredentials(creds);
        setSelectedTypes(new Set(creds.map((c) => c.type)));
        onSelectionChange?.(creds);
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
      onSelectionChange?.(credentials.filter((c) => next.has(c.type)));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, onSelectionChange]);

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
    setError(null);

    // ── Biometric gate — require Face ID / Touch ID / passkey before sharing ──
    const confirmed = await confirmBiometric();
    if (!confirmed) {
      setError(biometricError ?? 'Biometric confirmation required to share your profile.');
      return;
    }

    setIsSharing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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
          // C3 — lets the backend resolve and verify the recipient itself.
          opportunityId: recipient?.opportunityId,
        }),
      });

      if (res.status === 401) {
        /*
         * The authentication boundary — reached, not failed. Nothing was sent.
         *
         * C7: this does NOT fire authentication_started. A 401 is the API's
         * event, not the user's; the funnel step belongs to the moment the
         * clinician actually chooses to sign in (the action below).
         */
        setAuthRequired(true);
        onAuthRequired?.();
        setError('Preview only — nothing has been sent.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? 'Share failed. Please try again.');
      }

      const result = await res.json() as ShareResult;
      // share_completed fires ONLY here — the backend event actually succeeded.
      trackFunnelEvent(FUNNEL_EVENTS.SHARE_COMPLETED);
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
      const res = await fetch(`/api/apply/share/${shareResult.shareId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? 'Revoke failed.');
      }
      // share_revoked fires ONLY here — the backend revocation succeeded.
      trackFunnelEvent(FUNNEL_EVENTS.SHARE_REVOKED);
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
        className={triggerCls}
        style={triggerStyle}
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
      <div
        className={careerLoop ? 'absolute inset-0 bg-[color:var(--ink,#12100D)]/60' : 'absolute inset-0 bg-black/70 backdrop-blur-sm'}
        onClick={closeModal}
      />

      <div className={panelCls}>

        {/* Mobile grabber */}
        <div className="absolute top-0 inset-x-0 flex justify-center py-2 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4 mt-2 sm:mt-0">
          <div className="flex items-center gap-2">
            <VCVIcon className="h-5 w-5" />
            <span className="text-sm font-semibold text-foreground">Apply with VitalCV</span>
            {/* Step indicator */}
            <div className="flex items-center gap-1 ml-2">
              {(['credentials', 'org_context', 'confirmed'] as Step[]).map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    step === s ? 'bg-emerald-400' :
                    (['credentials', 'org_context', 'confirmed'].indexOf(step) > i) ? 'bg-muted' :
                    'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">

          {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

          {error && (
            <div className={careerLoop
              ? 'border-2 border-[color:var(--ink,#12100D)] bg-white px-4 py-3.5 text-[14px] text-[color:var(--ink,#12100D)]'
              : 'rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300'}>
              {error}
              {authRequired && (
                <>
                  {' '}
                  {ownershipPending ? (
                    /*
                     * The real route into verification. It is NOT a "claim"
                     * button: clicking claim does not verify anything, and
                     * offering one here would tell the clinician their
                     * ownership is settled when it is not.
                     */
                    <Link
                      href={`/holder/settings?npi=${encodeURIComponent(npi)}&intent=verify-ownership`}
                      onClick={() => trackFunnelEvent(FUNNEL_EVENTS.OWNERSHIP_VERIFICATION_STARTED)}
                      className={careerLoop ? 'font-semibold underline underline-offset-2' : 'font-semibold text-emerald-300 underline'}
                    >
                      Verify this NPI
                    </Link>
                  ) : (
                    <Link
                      href="/sign-in"
                      // C7 — the funnel step belongs to the user's real choice
                      // to authenticate, not to the API's 401.
                      onClick={() => trackFunnelEvent(FUNNEL_EVENTS.AUTHENTICATION_STARTED)}
                      className={careerLoop ? 'font-semibold underline underline-offset-2' : 'font-semibold text-emerald-300 underline'}
                    >
                      Sign in to send
                    </Link>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 1: Credentials ── */}
          {!isLoading && step === 'credentials' && trustState && (
            <>
              {/* Trust state */}
              <div className="rounded-xl border border-white/8 bg-card px-4 py-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trust Readiness</p>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${levelColor}`}>
                    {trustState.readiness_level}
                  </span>
                  <div>
                    <p className={cx('text-sm font-semibold', careerLoop ? 'text-[color:var(--ink-strong,#0E0D0B)]' : 'text-foreground')}>
                      {trustState.readiness_status}
                    </p>
                    {/* A numeric readiness score is a compiled metric about a
                        person. It stays in the signed-in product, and is not
                        rendered on the acquisition surface. */}
                    {!careerLoop && (
                      <p className="text-xs text-zinc-500">Score: {trustState.readiness_score}/100</p>
                    )}
                  </div>
                </div>
                {!careerLoop && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                      style={{ width: `${trustState.readiness_score}%` }}
                    />
                  </div>
                )}
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
                        className="flex items-center min-h-[52px] gap-3 rounded-xl border border-white/8 bg-card px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.has(cred.type)}
                          onChange={() => toggleCredential(cred.type)}
                          className="h-5 w-5 rounded border-border bg-black/20 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{credentialTypeLabel(cred.type)}</p>
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
                  className={fieldCls}
                />
                {orgCtxErrors.name && <p className="mt-1 text-[10px] text-red-400">{orgCtxErrors.name}</p>}
              </div>

              {/* Org ID — a RESOLVED recipient is shown as a fact; only a
                  manual share (no selected opportunity) asks for an id. */}
              {recipient ? (
                <div>
                  <p className={cx('block text-xs font-medium mb-1.5', careerLoop ? 'text-[color:var(--ink-muted,#57534A)]' : 'text-zinc-300')}>
                    Receiving organization
                  </p>
                  <p className={cx('text-sm', careerLoop ? 'font-medium text-[color:var(--ink-strong,#0E0D0B)]' : 'text-foreground')}>
                    {recipient.organizationName}
                  </p>
                  <p className={cx('mt-1 text-[11px]', careerLoop ? 'text-[color:var(--ink-subtle,#676257)]' : 'text-zinc-500')}>
                    Resolved from the opportunity you selected · verified again when you send
                  </p>
                </div>
              ) : (
                <div>
                  <label className={cx('block text-xs font-medium mb-1.5', careerLoop ? 'text-[color:var(--ink-muted,#57534A)]' : 'text-zinc-300')}>
                    Organization ID <span className="text-red-400">*</span>
                    <span className="ml-1 text-[10px] font-normal opacity-70">(system ID, NPI, or slug)</span>
                  </label>
                  <input
                    type="text"
                    value={orgCtx.organization_id}
                    onChange={(e) => setOrgCtx((p) => ({ ...p, organization_id: e.target.value }))}
                    placeholder="e.g. stanford-health-care or 1234567890"
                    className={fieldCls}
                  />
                  {orgCtxErrors.organization_id && <p className="mt-1 text-[10px] text-red-400">{orgCtxErrors.organization_id}</p>}
                </div>
              )}

              {/* Purpose */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Purpose of use <span className="text-red-400">*</span>
                </label>
                <select
                  value={orgCtx.purpose_of_use}
                  onChange={(e) => setOrgCtx((p) => ({ ...p, purpose_of_use: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-zinc-900 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
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
                  className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder-zinc-600 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
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
                  <code className="flex-1 rounded-lg border border-border bg-black/30 px-3 py-2 text-xs text-zinc-300 truncate font-mono">
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
                    className="shrink-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-white/12 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Reusable readiness snapshot (Wave M) */}
              {shareResult.readinessSnapshotPath ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                    Reusable readiness snapshot
                  </p>
                  <a
                    href={shareResult.readinessSnapshotPath}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-border bg-black/30 px-3 py-2 text-xs text-emerald-300 truncate font-mono hover:border-emerald-500/40 transition-colors"
                  >
                    {shareResult.readinessSnapshotPath}
                  </a>
                  <p className="mt-1.5 text-[10px] text-zinc-600 leading-relaxed">
                    Your evidence as issued right now — reviewers you give this to see the same
                    snapshot, every access is audited, and revoking this share closes it.
                  </p>
                </div>
              ) : null}

              {/* Credentials shared summary */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                  Credentials shared ({Array.from(selectedTypes).length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedTypes).map((type) => (
                    <span key={type} className="inline-flex text-[10px] font-medium bg-muted text-zinc-300 px-2 py-1 rounded-lg">
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
                onClick={() => { trackFunnelEvent(FUNNEL_EVENTS.SHARE_PREVIEWED); setStep('org_context'); }}
                disabled={selectedTypes.size === 0}
                className={cx('w-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed', careerLoop
                  ? 'min-h-[56px] text-[16px] font-semibold text-white'
                  : 'min-h-[52px] rounded-xl bg-emerald-500 font-semibold text-foreground shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 active:scale-[0.98]')}
                style={primaryStyle}
              >
                Next: Share destination ({selectedTypes.size} credential{selectedTypes.size !== 1 ? 's' : ''}) →
              </button>
            )}

            {step === 'org_context' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="flex-1 py-3 rounded-xl border border-border text-xs font-medium text-zinc-400 hover:text-foreground hover:border-border transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isSharing || isConfirming}
                  className={cx('flex-[3] flex items-center justify-center gap-2 transition-all disabled:opacity-50', careerLoop
                    ? 'min-h-[56px] text-[16px] font-semibold text-white'
                    : 'min-h-[52px] rounded-xl bg-emerald-500 font-semibold text-foreground hover:bg-emerald-400 active:scale-[0.98]')}
                  style={primaryStyle}
                >
                  {isConfirming ? <><Spinner size="sm" /> Confirm identity…</> : isSharing ? <><Spinner size="sm" /> Sharing…</> : 'Sign & Share'}
                </button>
              </div>
            )}

            {step === 'confirmed' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-border text-xs font-medium text-zinc-400 hover:text-foreground transition-colors"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setShareResult(null);
                    setOrgCtx(baseOrgCtx());
                  }}
                  className="flex-1 py-3 rounded-xl border border-border text-xs font-medium text-zinc-400 hover:text-foreground transition-colors"
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

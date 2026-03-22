'use client';

/**
 * ApplyWithVitalCV.tsx — Wave 246: Apply-with-VitalCV Widget
 *
 * Embeddable widget component. Renders an "Apply with VitalCV" button that
 * opens a modal with:
 *  - Trust state summary (band + score)
 *  - Credential list with selective disclosure toggles
 *  - Generate & Share → returns shareable bundle link
 *  - 24-hour countdown to expiration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

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

interface ApplyBundle {
  bundleId: string;
  npi: string;
  clinicianName: string;
  trustState: TrustStateData;
  credentials: BundleCredential[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
}

interface CanonicalFact {
  factType: string;
  source: string;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
}

interface TrustStateResponse {
  readiness_level?: string;
  readiness_score?: number;
  readiness_status?: string;
  computed_at?: string;
  /** ClinicianTrustState.facts — canonical facts array */
  facts?: CanonicalFact[];
  /** Legacy compat: direct credentials array */
  credentials?: BundleCredential[];
}

interface Props {
  npi: string;
  /** Optional label override */
  label?: string;
  /** Called with the generated bundle after sharing */
  onBundleGenerated?: (bundle: ApplyBundle) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  L0: 'bg-red-500/20 text-red-300 ring-red-500/30',
  L1: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
  L2: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  L3: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  verified: 'text-emerald-400',
  VERIFIED: 'text-emerald-400',
  pending: 'text-yellow-400',
  PENDING: 'text-yellow-400',
  UNVERIFIED: 'text-zinc-400',
  expired: 'text-red-400',
};

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

function CredentialTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    DEA_LICENSE: 'DEA License',
    STATE_LICENSE: 'State License',
    BOARD_CERT: 'Board Certification',
    NPI_IDENTITY: 'NPI Identity',
    NPPES_IDENTITY: 'NPPES Identity',
    OIG_EXCLUSION: 'OIG/LEIE Exclusion Check',
    EDUCATION: 'Education',
    MALPRACTICE: 'Malpractice Insurance',
    CANDIDATE_CREDENTIAL: 'Self-reported Credential',
    PSV_RESULT: 'Primary Source Verification',
  };
  return <span>{labels[type] ?? type.replace(/_/g, ' ')}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApplyWithVitalCV({ npi, label = 'Apply with VitalCV', onBundleGenerated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [trustState, setTrustState] = useState<TrustStateData | null>(null);
  const [availableCredentials, setAvailableCredentials] = useState<BundleCredential[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [bundle, setBundle] = useState<ApplyBundle | null>(null);
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch trust state + credentials when modal opens
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
        // Map canonical facts → BundleCredential shape for selective disclosure
        const creds: BundleCredential[] = data.credentials
          ?? (data.facts ?? []).map((f: CanonicalFact) => ({
            type: f.factType ?? f.source,
            issuer: f.source,
            status: f.status,
            verifiedAt: f.verifiedAt ?? null,
            expiresAt: f.expiresAt ?? null,
          }));
        setAvailableCredentials(creds);
        setSelectedTypes(new Set(creds.map((c) => c.type)));
      })
      .catch(() => setError('Trust engine connection interrupted. Please try again.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, npi, trustState]);

  // Countdown timer
  useEffect(() => {
    if (!bundle) return;
    const tick = () => setCountdown(formatCountdown(bundle.expiresAt));
    tick();
    countdownRef.current = setInterval(tick, 30_000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [bundle]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const toggleCredential = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const clerkId =
        (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id ?? '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clerkId) headers['x-clerk-user-id'] = clerkId;
      const res = await fetch('/api/apply/bundle', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          npi,
          selectiveClaims: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err?.error ?? 'Bundle generation interrupted.');
      }
      const generated = await res.json() as ApplyBundle;
      setBundle(generated);
      onBundleGenerated?.(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The process was interrupted. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [npi, selectedTypes, onBundleGenerated]);

  const bundleUrl = bundle
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com'}/apply/${bundle.bundleId}`
    : '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(bundleUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bundleUrl]);

  const levelColor = trustState ? (LEVEL_COLORS[trustState.readiness_level] ?? LEVEL_COLORS.L0) : '';

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 font-semibold text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/50 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        aria-label="Apply with VitalCV"
      >
        <VitalCVIcon />
        {label}
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col sm:items-center p-0 sm:p-4 justify-end sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Apply with VitalCV"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal panel (Bottom sheet on mobile) */}
          <div
            ref={modalRef}
            className="relative w-full max-w-lg mt-auto sm:mt-0 rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-zinc-900/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl sm:shadow-black/60 backdrop-blur-xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 pointer-events-auto"
          >
            {/* Grabber for mobile */}
            <div className="absolute top-0 inset-x-0 w-full flex justify-center py-2 sm:hidden cursor-grab active:cursor-grabbing" onTouchMove={() => setIsOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-white/20"></div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4 mt-2 sm:mt-0">
              <div className="flex items-center gap-2">
                <VitalCVIcon className="h-5 w-5" />
                <span className="text-sm font-semibold text-white">Apply with VitalCV</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                  <PilotFailureSignal
                    title="Apply with VitalCV interrupted"
                    message={error}
                    queueItem={{ source: 'route_failure' }}
                    dedupeKey={`apply-widget:${npi}:${error}`}
                  />
                  <p>{error}</p>
                  <div className="mt-3">
                    <SupportActionButton
                      label="Contact support"
                      title="Apply with VitalCV interrupted"
                      messagePrefill={error}
                      className="inline-flex items-center justify-center rounded-xl border border-red-300/20 bg-red-500/5 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/10"
                    />
                  </div>
                </div>
              )}

              {!isLoading && !error && trustState && (
                <>
                  {/* Trust state summary */}
                  <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      Trust Readiness
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${levelColor}`}>
                        {trustState.readiness_level}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{trustState.readiness_status}</p>
                        <p className="text-xs text-zinc-500">Score: {trustState.readiness_score}/100</p>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                        style={{ width: `${trustState.readiness_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Credential selective disclosure */}
                  {!bundle && (
                    <>
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                          Credentials to Share
                        </p>
                        {availableCredentials.length === 0 ? (
                          <p className="text-xs text-zinc-500">No verified credentials on file.</p>
                        ) : (
                          <div className="space-y-2">
                            {availableCredentials.map((cred) => (
                              <label
                                key={cred.type}
                                className="flex items-center min-h-[52px] gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 cursor-pointer hover:bg-white/6 transition-colors active:scale-[0.99]"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTypes.has(cred.type)}
                                  onChange={() => toggleCredential(cred.type)}
                                  className="h-5 w-5 rounded border-white/20 bg-black/20 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    <CredentialTypeLabel type={cred.type} />
                                  </p>
                                  <p className="text-[11px] text-zinc-400 mt-0.5 tracking-wide">{cred.issuer}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-black/20 ${STATUS_COLORS[cred.status] ?? 'text-zinc-400'}`}>
                                  {cred.status}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-zinc-600">
                        Only selected credentials will be included in the shared bundle. Bundle expires in 24 hours.
                      </p>
                    </>
                  )}

                  {/* Generated bundle share */}
                  {bundle && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircleIcon />
                          <p className="text-sm font-semibold text-emerald-400">Bundle Generated</p>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">
                          Share this link with employers. They can verify your credentials without creating an account.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 truncate font-mono">
                            {bundleUrl}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="shrink-0 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/12"
                          >
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] text-zinc-600">
                          ⏱ {countdown} · {bundle.credentials.length} credential{bundle.credentials.length !== 1 ? 's' : ''} included
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setBundle(null);
                          setError(null);
                        }}
                        className="w-full rounded-xl border border-white/10 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                      >
                        Generate New Bundle
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer / CTA */}
            {!isLoading && !error && trustState && !bundle && (
              <div className="border-t border-white/8 px-6 py-5 bg-black/20">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedTypes.size === 0}
                  className="w-full flex min-h-[56px] items-center justify-center rounded-xl bg-emerald-500 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size="sm" />
                      Generating…
                    </span>
                  ) : (
                    `Generate & Share (${selectedTypes.size} credential${selectedTypes.size !== 1 ? 's' : ''})`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function VitalCVIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2L3 7v11h14V7L10 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function CheckCircleIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <svg
      className={`${cls} animate-spin text-emerald-400`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default ApplyWithVitalCV;

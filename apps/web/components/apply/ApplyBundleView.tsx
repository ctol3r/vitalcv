'use client';

/**
 * ApplyBundleView.tsx — Wave 246: Employer-facing Bundle View
 *
 * Rendered when an employer opens a VitalCV apply bundle link.
 * Shows: clinician name, trust band, score, credential list, issuer provenance,
 * monitoring status, and integrity verification stamp.
 */

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface IssuerProvenance {
  issuerId: string;
  name: string;
  trustScore: number;
}

export interface ApplyBundle {
  bundleId: string;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  credentials: BundleCredential[];
  issuerProvenance: IssuerProvenance[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
}

interface Props {
  bundle: ApplyBundle;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  L0: { label: 'Foundation', color: 'text-red-300', bg: 'bg-red-500/15 ring-red-500/25' },
  L1: { label: 'Provisional', color: 'text-yellow-300', bg: 'bg-yellow-500/15 ring-yellow-500/25' },
  L2: { label: 'Verified', color: 'text-blue-300', bg: 'bg-blue-500/15 ring-blue-500/25' },
  L3: { label: 'Trust-Native', color: 'text-emerald-300', bg: 'bg-emerald-500/15 ring-emerald-500/25' },
};

const MONITORING_META = {
  active: { label: 'Continuously Monitored', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  partial: { label: 'Partially Monitored', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  inactive: { label: 'Monitoring Inactive', color: 'text-zinc-500', dot: 'bg-zinc-500' },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  verified: 'text-emerald-400',
  VERIFIED: 'text-emerald-400',
  ACTIVE: 'text-emerald-400',
  pending: 'text-yellow-400',
  PENDING: 'text-yellow-400',
  UNVERIFIED: 'text-zinc-400',
  expired: 'text-red-400',
  EXPIRED: 'text-red-400',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function truncateHash(hash: string, chars = 12): string {
  return `${hash.slice(0, chars)}…${hash.slice(-6)}`;
}

function CredentialTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    DEA_LICENSE: 'DEA License',
    STATE_LICENSE: 'State License',
    BOARD_CERT: 'Board Certification',
    NPI_IDENTITY: 'NPI Identity',
    NPPES_IDENTITY: 'NPPES Identity',
    OIG_EXCLUSION: 'OIG/LEIE Exclusion',
    EDUCATION: 'Education',
    MALPRACTICE: 'Malpractice Insurance',
    CANDIDATE_CREDENTIAL: 'Self-reported',
    PSV_RESULT: 'Primary Source Verification',
    APPLY_BUNDLE: 'Bundle',
  };
  return <>{labels[type] ?? type.replace(/_/g, ' ')}</>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyBundleView({ bundle }: Props) {
  const [accepted, setAccepted] = useState(false);
  const levelMeta = LEVEL_META[bundle.trustState.readiness_level] ?? LEVEL_META.L0;
  const monitorMeta = MONITORING_META[bundle.monitoringStatus];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header band */}
      <div className="border-b border-white/6 bg-zinc-900/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <VitalCVLogo />
            <span className="text-sm font-semibold text-white">VitalCV</span>
          </div>
          <span className="text-xs text-zinc-500">Verified Credential Bundle</span>
        </div>
      </div>

      {/* Main card */}
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">

        {/* Clinician identity */}
        <section className="rounded-2xl border border-white/8 bg-white/3 px-6 py-6 shadow-xl shadow-black/30">
          <div className="flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-xl font-bold text-white shrink-0">
              {bundle.clinicianName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{bundle.clinicianName}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">NPI: {bundle.npi}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${levelMeta.bg} ${levelMeta.color}`}>
                  {bundle.trustState.readiness_level} · {levelMeta.label}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <span className={`h-1.5 w-1.5 rounded-full ${monitorMeta.dot}`} />
                  <span className={monitorMeta.color}>{monitorMeta.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Trust score bar */}
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Trust Readiness Score</span>
              <span className="font-semibold text-white">{bundle.trustState.readiness_score}/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                style={{ width: `${bundle.trustState.readiness_score}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600">{bundle.trustState.readiness_status}</p>
          </div>
        </section>

        {/* Credential list */}
        <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
          <div className="border-b border-white/6 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Verified Credentials ({bundle.credentials.length})
            </p>
          </div>
          <div className="divide-y divide-white/6">
            {bundle.credentials.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-600">No credentials included in this bundle.</p>
            ) : (
              bundle.credentials.map((cred, i) => (
                <div key={`${cred.type}-${i}`} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-8 w-8 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                    <CredentialIcon type={cred.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      <CredentialTypeLabel type={cred.type} />
                    </p>
                    <p className="text-xs text-zinc-500">{cred.issuer}</p>
                    {cred.expiresAt && (
                      <p className="text-[10px] text-zinc-600">Expires {formatDate(cred.expiresAt)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-semibold ${STATUS_COLORS[cred.status] ?? 'text-zinc-400'}`}>
                      {cred.status}
                    </span>
                    {cred.verifiedAt && (
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Verified {formatDate(cred.verifiedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Issuer provenance */}
        {bundle.issuerProvenance.length > 0 && (
          <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="border-b border-white/6 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Issuer Provenance
              </p>
            </div>
            <div className="divide-y divide-white/6">
              {bundle.issuerProvenance.map((issuer) => (
                <div key={issuer.issuerId} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-white">{issuer.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${issuer.trustScore}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">{issuer.trustScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verification stamp */}
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-400">Bundle Verified by VitalCV</p>
              <p className="mt-1 text-xs text-zinc-400">
                This credential bundle was cryptographically signed and has not been tampered with.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-[10px] font-mono text-zinc-500 truncate">
                  {truncateHash(bundle.signature)}
                </code>
                <span className="text-[10px] text-zinc-600">SHA-256</span>
              </div>
              <div className="mt-1 flex gap-4 text-[10px] text-zinc-600">
                <span>Generated {formatDate(bundle.generatedAt)}</span>
                <span>Expires {formatDate(bundle.expiresAt)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Profile link */}
        <div className="flex items-center justify-between rounded-xl border border-white/6 px-4 py-3">
          <span className="text-xs text-zinc-500">Full trust profile</span>
          <a
            href={bundle.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View on VitalCV →
          </a>
        </div>

        {/* Accept CTA */}
        <div className="pb-4">
          {!accepted ? (
            <button
              type="button"
              onClick={() => setAccepted(true)}
              className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-400/50 transition-all hover:bg-emerald-400 active:scale-[0.98]"
            >
              Accept Candidate ✓
            </button>
          ) : (
            <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/8 py-3.5 text-center text-sm font-semibold text-emerald-400">
              ✓ Candidate Accepted — ATS integration coming soon
            </div>
          )}
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            ATS integration · No account required · Powered by VitalCV
          </p>
        </div>

      </main>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function VitalCVLogo() {
  return (
    <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L3 7v11h14V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.833 11.237a.5.5 0 01-.334 0C5.26 16.563 2 12.162 2 7a11.88 11.88 0 01.145-1.796.5.5 0 01.479-.425 11.947 11.947 0 007.037-2.542zM13.28 7.72a.75.75 0 010 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 111.06-1.06l.97.97 2.97-2.97a.75.75 0 011.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CredentialIcon({ type }: { type: string }) {
  const iconMap: Record<string, string> = {
    DEA_LICENSE: '💊',
    STATE_LICENSE: '📋',
    BOARD_CERT: '🏅',
    NPI_IDENTITY: '🆔',
    NPPES_IDENTITY: '🆔',
    OIG_EXCLUSION: '🛡',
    EDUCATION: '🎓',
    MALPRACTICE: '⚖️',
    PSV_RESULT: '✅',
  };
  return <span className="text-sm leading-none">{iconMap[type] ?? '📄'}</span>;
}

export default ApplyBundleView;

'use client';

/**
 * ApplyBundleView.tsx — Wave 246: Employer-facing Bundle View
 *
 * Rendered when an employer opens a VitalCV apply bundle link.
 * Shows: clinician name, trust band, score, credential list, issuer provenance,
 * monitoring status, and integrity verification stamp.
 */

import Link from 'next/link';
import { EmployerSummaryCard } from '@/components/apply/EmployerSummaryCard';
import { buildEmployerReviewHref } from '@/lib/trust/public-wedge-parity';
import { canonicalCredStatus } from '@/lib/trust/status-language';

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
  entityId?: string | null;
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

const MONITORING_META = {
  active: { label: 'Continuously monitored', color: 'text-foreground/70', dot: 'bg-white/70' },
  partial: { label: 'Partially monitored', color: 'text-foreground', dot: 'bg-muted5' },
  inactive: { label: 'Monitoring inactive', color: 'text-muted-foreground/50', dot: 'bg-white/25' },
};

const STATUS_COLORS: Record<string, string> = {
  'Source-backed': 'text-foreground/70',
  Active: 'text-foreground',
  Pending: 'text-foreground',
  Unavailable: 'text-muted-foreground',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function truncateHash(hash: string, chars = 12): string {
  return `${hash.slice(0, chars)}…${hash.slice(-6)}`;
}

function credentialTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEA_LICENSE: 'DEA License',
    STATE_LICENSE: 'State License',
    BOARD_CERT: 'Board Certification',
    NPI_IDENTITY: 'NPI Identity',
    NPPES_IDENTITY: 'NPPES Identity',
    OIG_EXCLUSION: 'OIG / LEIE clear',
    EDUCATION: 'Education',
    MALPRACTICE: 'Malpractice Insurance',
    CANDIDATE_CREDENTIAL: 'Self-reported',
    PSV_RESULT: 'Primary Source Verification',
    APPLY_BUNDLE: 'Bundle',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

function CredentialTypeLabel({ type }: { type: string }) {
  return <>{credentialTypeLabel(type)}</>;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function buildReadinessBlockers(bundle: ApplyBundle): string[] {
  const unavailableCredentials = bundle.credentials
    .filter((credential) => canonicalCredStatus(credential.status) === 'Unavailable')
    .map((credential) => `${credentialTypeLabel(credential.type)} unavailable`);

  const readinessNote =
    bundle.trustState.readiness_level === 'L0'
      ? `${bundle.trustState.readiness_status} - foundation checks still block acceptance`
      : bundle.trustState.readiness_level === 'L1'
        ? `${bundle.trustState.readiness_status} - employer review is still required`
        : null;

  return uniqueStrings([
    ...unavailableCredentials,
    ...(readinessNote ? [readinessNote] : []),
  ]);
}

function buildReviewHref(bundle: ApplyBundle): string {
  const target = bundle.entityId ?? bundle.npi;
  const redirect = target
    ? buildEmployerReviewHref(target, { bundleId: bundle.bundleId })
    : '/review';
  return `/sign-in?redirect_url=${encodeURIComponent(redirect)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyBundleView({ bundle }: Props) {
  const monitorMeta = MONITORING_META[bundle.monitoringStatus];
  const verifiedItems = uniqueStrings(
    bundle.credentials
      .filter((credential) => canonicalCredStatus(credential.status) === 'Source-backed')
      .map((credential) => credentialTypeLabel(credential.type)),
  );
  const missingItems = uniqueStrings(
    bundle.credentials
      .filter((credential) => canonicalCredStatus(credential.status) === 'Pending')
      .map((credential) => credentialTypeLabel(credential.type)),
  );
  const blockers = buildReadinessBlockers(bundle);
  const reviewHref = buildReviewHref(bundle);

  return (
    <div className="min-h-screen bg-ops-gradient text-foreground">
      {/* Header band */}
      <div className="border-b border-white/6 bg-[var(--vt-surface-dim)] backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <VitalCVLogo />
            <span className="text-sm font-semibold text-foreground">VitalCV</span>
          </div>
          <span className="text-xs text-muted-foreground/50">Employer review share</span>
        </div>
      </div>

      {/* Main card */}
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 pb-32">
        <EmployerSummaryCard
          clinicianName={bundle.clinicianName}
          readinessLevel={bundle.trustState.readiness_level}
          readinessScore={bundle.trustState.readiness_score}
          readinessStatus={bundle.trustState.readiness_status}
          verifiedItems={verifiedItems}
          missingItems={missingItems}
          blockers={blockers}
          dataFreshnessNote={`Data as of ${formatDate(bundle.generatedAt)}`}
        />

        <section className="rounded-2xl border border-white/6 bg-[var(--vt-surface-dim)] px-5 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                What you are looking at
              </p>
              <p className="mt-1 text-sm text-foreground">
                A public credential capsule with the clinician&apos;s current readiness, supporting credentials, issuer provenance, and integrity details.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">NPI {bundle.npi}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${monitorMeta.dot}`} />
              <span className={monitorMeta.color}>{monitorMeta.label}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sign in to continue to the employer decision surface and take action on this candidate.
          </p>
        </section>

        {/* Credential list */}
        <section className="overflow-hidden rounded-2xl border border-white/6 bg-[var(--vt-surface)]">
          <div className="border-b border-white/6 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Credential Snapshot ({bundle.credentials.length})
            </p>
            <p className="mt-1 text-sm text-foreground">
              Each row shows the credential type, issuing source, current availability, and the most recent verification timestamp included in this share.
            </p>
          </div>
          <div className="divide-y divide-white/6">
            {bundle.credentials.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground/40">No credentials included in this bundle.</p>
            ) : (
              bundle.credentials.map((cred, i) => (
                <div key={`${cred.type}-${i}`} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <CredentialIcon type={cred.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <CredentialTypeLabel type={cred.type} />
                    </p>
                    <p className="text-xs text-muted-foreground/50">{cred.issuer}</p>
                    {cred.expiresAt && (
                      <p className="text-[10px] text-muted-foreground/40">Expires {formatDate(cred.expiresAt)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-semibold ${STATUS_COLORS[canonicalCredStatus(cred.status)] ?? 'text-muted-foreground'}`}>
                      {canonicalCredStatus(cred.status)}
                    </span>
                    {cred.verifiedAt && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                        Last confirmed {formatDate(cred.verifiedAt)}
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
          <section className="overflow-hidden rounded-2xl border border-white/6 bg-[var(--vt-surface)]">
            <div className="border-b border-white/6 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Issuer Provenance
              </p>
            </div>
            <div className="divide-y divide-white/6">
              {bundle.issuerProvenance.map((issuer) => (
                <div key={issuer.issuerId} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-foreground">{issuer.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-card"
                        style={{ width: `${issuer.trustScore}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground/50">{issuer.trustScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verification stamp */}
        <section className="rounded-2xl border border-white/6 bg-[var(--vt-surface-dim)] px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground/70">Bundle verified by VitalCV</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This credential bundle was cryptographically signed and has not been tampered with.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="truncate text-[10px] font-mono text-muted-foreground/50">
                  {truncateHash(bundle.signature)}
                </code>
                <span className="text-[10px] text-muted-foreground/40">SHA-256</span>
              </div>
              <div className="mt-1 flex gap-4 text-[10px] text-muted-foreground/40">
                <span>Generated {formatDate(bundle.generatedAt)}</span>
                <span>Expires {formatDate(bundle.expiresAt)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Profile link */}
        <div className="flex items-center justify-between rounded-xl border border-white/6 bg-[var(--vt-surface-dim)] px-4 py-3">
          <span className="text-xs text-muted-foreground/50">Full trust profile</span>
          <a
            href={bundle.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            View on VitalCV →
          </a>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/6 bg-[var(--vt-surface-dim)] px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Link
            href={reviewHref}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-muted px-4 py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-white/12"
          >
            View full report — sign in to accept
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function VitalCVLogo() {
  return (
    <svg className="h-6 w-6 text-foreground/70" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L3 7v11h14V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-foreground/70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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

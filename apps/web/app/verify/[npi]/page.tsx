/**
 * /verify/[npi] — Verifier Reading Mode
 *
 * Public server component. No auth required.
 * Hospital reviewer can inspect a clinician's trust posture in <30s.
 *
 * Layout:
 *   Header (Verifier View — Read-Only Access)
 *   → Identity + proof tier hero
 *   → ProvenanceStrip (per-lane)
 *   → ReceiptVerificationPane (first receipt, if available)
 *   → IssuerContinuityPanel
 *   → ReplayChronologyPanel
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eye, ShieldAlert } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { ProvenanceStrip } from '@/components/verifier/ProvenanceStrip';
import { ReceiptVerificationPane } from '@/components/verifier/ReceiptVerificationPane';
import { IssuerContinuityPanel } from '@/components/verifier/IssuerContinuityPanel';
import { ReplayChronologyPanel } from '@/components/verifier/ReplayChronologyPanel';
import type { LaneSnapshot } from '@/components/proof/trust-types';
import { VerdictSplit, type VerdictItem } from '@/design-system/components';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  normalizeEmployerAcceptanceHistoryResponse,
  type EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';
import { acceptanceScopeLabel, formatAcceptedAt } from '@/lib/recognition/acceptance-recognition';

// ── Constants ──────────────────────────────────────────────────────────────────

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:4000';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatUtc(ts: string | number | null | undefined): string {
  if (ts == null || ts === '') return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString().slice(0, 19) + 'Z';
}

/** True only when a string has visible content — keeps empty fields honest. */
function nonBlank(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Compose one display line from an NPPES practice-location record. Returns ''
 * when no usable address text is present, so the caller omits the block rather
 * than render an empty source-backed field.
 */
function formatPracticeLocation(
  location: NonNullable<PassportData['practiceLocation']>,
): string {
  const cityState = [location.city, location.state].filter(nonBlank).join(', ');
  const cityStateZip = [cityState, location.postalCode].filter(nonBlank).join(' ');
  return [location.addressLine, cityStateZip].filter(nonBlank).join(' · ');
}

/** Self-reported education entry → single display line (institution + detail). */
function formatEducationEntry(entry: {
  institution: string;
  degree?: string;
  graduationYear?: number;
}): string {
  const detail = [
    entry.degree,
    entry.graduationYear != null ? String(entry.graduationYear) : undefined,
  ]
    .filter(nonBlank)
    .join(', ');
  return detail ? `${entry.institution} — ${detail}` : entry.institution;
}

/** Self-reported affiliation entry → single display line (organization + role). */
function formatAffiliationEntry(entry: { organization: string; role?: string }): string {
  return nonBlank(entry.role) ? `${entry.organization} — ${entry.role}` : entry.organization;
}

const TIER_CONFIG: Record<string, { label: string; cls: string }> = {
  DECISION_GRADE: {
    label: 'Decision Grade',
    cls: 'bg-green-100 text-green-800 border border-green-300',
  },
  PARTIAL: {
    label: 'Partial',
    cls: 'bg-amber-100 text-amber-800 border border-amber-300',
  },
  SNAPSHOT: {
    label: 'Snapshot',
    cls: 'bg-blue-100 text-blue-800 border border-blue-300',
  },
  NONE: {
    label: 'None',
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  decision_grade: {
    label: 'Decision Grade',
    cls: 'bg-green-100 text-green-800 border border-green-300',
  },
  partial: {
    label: 'Partial',
    cls: 'bg-amber-100 text-amber-800 border border-amber-300',
  },
  none: {
    label: 'None',
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
};

/**
 * Map passport sourceCoverage checks → LaneSnapshot[] compatible with
 * the verifier components (which use trust-types.ts LaneSnapshot shape).
 */
function checksToLaneSnapshots(
  checks: PassportData['sourceCoverage']['checks'],
): LaneSnapshot[] {
  return checks.map((c) => {
    const checkedAtMs = c.checkedAt ? new Date(c.checkedAt).getTime() : null;
    const receiptId = c.proof?.receiptIds?.[0] ?? null;

    // Map canonical state → SourceStatus (best-effort)
    const statusMap: Record<string, LaneSnapshot['status']> = {
      checked: 'verified',
      stale: 'stale',
      pending: 'in_progress',
      gated: 'access_required',
      unavailable: 'unavailable',
      accessRequired: 'access_required',
      reviewRequired: 'review_required',
      notDecisionGrade: 'not_checked',
      previewOnly: 'not_checked',
    };

    return {
      laneId: c.sourceId,
      status: statusMap[c.state] ?? 'not_checked',
      checkedAt: isNaN(checkedAtMs as number) ? null : checkedAtMs,
      source: c.sourceUrl ?? undefined,
      receiptId,
    };
  });
}

// ── Data fetching ──────────────────────────────────────────────────────────────

/**
 * Public passport read. /api/passport/npi/:npi is anonymous by design
 * (value before login) and serves the PassportData contract this page
 * renders — coverage states and readiness only, restricted credential
 * labels redacted for unauthenticated viewers.
 */
async function fetchPassport(npi: string): Promise<PassportData | null> {
  try {
    const res = await fetch(
      `${BACKEND}/api/passport/npi/${encodeURIComponent(npi)}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 }, // 60s cache; verifier read is non-real-time
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as PassportData;
  } catch {
    return null;
  }
}

/**
 * Recorded employer acceptances (Recognition → Acceptance → Start, middle
 * step). Public read, same anonymized payload the review surface shows.
 * Null means the lookup failed — rendered as a system state, never as an
 * empty record.
 */
async function fetchAcceptanceHistory(
  npi: string,
): Promise<EmployerAcceptanceHistoryResponse | null> {
  try {
    const res = await fetch(
      `${BACKEND}/api/employer-review/${encodeURIComponent(npi)}/acceptance-history`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    return normalizeEmployerAcceptanceHistoryResponse(await res.json());
  } catch {
    return null;
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ npi: string }>;
}): Promise<Metadata> {
  const { npi } = await params;
  return {
    title: `Verifier View — NPI ${npi} | VitalCV`,
    description: 'Read-only credential verification for hospital and employer reviewers.',
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export default async function VerifierPage({
  params,
}: {
  params: Promise<{ npi: string }>;
}) {
  const { npi } = await params;
  // NPIs are 10-digit strings; anything else cannot resolve — 404 before any
  // backend fetch (Wave 2F route contract: malformed public ids are 404s).
  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }
  const [passport, acceptanceHistory] = await Promise.all([
    fetchPassport(npi),
    fetchAcceptanceHistory(npi),
  ]);

  if (!passport) {
    return <NotFound npi={npi} />;
  }

  // Derive lane snapshots from source coverage
  const lanes = checksToLaneSnapshots(passport.sourceCoverage?.checks ?? []);

  // Proof tier
  const proofTier =
    passport.trustContainer?.proofTier ??
    (passport.readiness?.status === 'DECISION_GRADE' ? 'DECISION_GRADE' : 'PARTIAL');
  const tierConfig = TIER_CONFIG[proofTier] ?? TIER_CONFIG.NONE;

  // Best receipt for the pane (first verified lane with a receipt)
  const firstReceiptLane = lanes.find((l) => l.receiptId && l.status === 'verified');
  const firstCheck = (passport.sourceCoverage?.checks ?? []).find(
    (c) => c.proof?.receiptIds?.[0] === firstReceiptLane?.receiptId,
  );

  const displayName = passport.identity?.displayName ?? `NPI ${npi}`;

  // New profile fields — both optional/nullable on PassportData. Render only
  // what is actually present: practiceLocation is source-backed (NPPES);
  // selfReported education/affiliations are user-entered. Never fabricate.
  const practiceLocationText = passport.practiceLocation
    ? formatPracticeLocation(passport.practiceLocation)
    : '';
  const selfReportedEducation = (passport.selfReported?.education ?? []).filter((e) =>
    nonBlank(e.institution),
  );
  const selfReportedAffiliations = (passport.selfReported?.affiliations ?? []).filter((a) =>
    nonBlank(a.organization),
  );
  const hasProfileDetail =
    practiceLocationText.length > 0 ||
    selfReportedEducation.length > 0 ||
    selfReportedAffiliations.length > 0;

  // ── Two-half verdict (W4 mount) — built ONLY from what this page really
  // has. Integrity = what this snapshot records (checks, receipts, tier).
  // Issuer legitimacy = the published issuer record this site serves.
  // Revocation is a VISIBLE step even though this public snapshot cannot
  // check it yet (the upstream read filters revoked artifacts) — honest
  // "Not checked" beats a silent omission; wiring the live status list is
  // the backend follow-up.
  const checkedLanes = lanes.filter((l) => l.status === 'verified');
  const receiptLanes = lanes.filter((l) => l.receiptId);
  const tierKey = String(proofTier).toLowerCase();
  const integrityItems: VerdictItem[] = [
    {
      label: 'Source checks recorded',
      status: checkedLanes.length > 0 ? 'pass' : 'pending',
      detail: `${checkedLanes.length} of ${lanes.length} lanes checked`,
      provenance: passport.lastCheckedAt ? `checked ${formatUtc(passport.lastCheckedAt)}` : undefined,
    },
    {
      label: 'Receipts recorded',
      status: receiptLanes.length > 0 ? 'pass' : 'pending',
      detail:
        receiptLanes.length > 0
          ? `${receiptLanes.length} check${receiptLanes.length === 1 ? '' : 's'} carry receipt ids`
          : 'no receipts on this snapshot',
    },
    {
      label: 'Coverage tier',
      status: tierKey.includes('decision') ? 'pass' : tierKey.includes('partial') ? 'mixed' : 'pending',
      detail: tierConfig.label,
    },
  ];
  const issuerItems: VerdictItem[] = [
    {
      label: 'Issuer record published',
      status: 'pass',
      detail: 'vitalcv.com',
      provenance: 'did:web:vitalcv.com · /.well-known/did.json',
    },
  ];

  // Revocation is a VISIBLE step, now backed by the real artifact-ledger count
  // the backend attaches (additive contract; older payloads fall back to the
  // honest "Not checked"). Any revoked artifact fails the whole verdict closed
  // — a reviewer must look before relying on anything here.
  const revocationStep = passport.revocation?.checked
    ? passport.revocation.revokedCount > 0
      ? {
          state: 'revoked' as const,
          source: `artifact ledger · ${passport.revocation.revokedCount} revoked`,
          checkedAt: passport.revocation.checkedAt ?? undefined,
        }
      : {
          state: 'none-found' as const,
          source: 'artifact ledger',
          checkedAt: passport.revocation.checkedAt ?? undefined,
        }
    : { state: 'unknown' as const, source: 'not checked on this public snapshot' };

  return (
    <div className="mz mz-paper mz-persona-verifier min-h-screen overflow-hidden">
      {/* ── Read-Only Header ───────────────────────────────────────────────── */}
      <div className="border-b border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--ink-800)]">
              Credential Verification
            </span>
          </div>
          <span className="mz-mono text-[10px] text-[var(--ink-500)] bg-[var(--ink-50)] border border-[var(--rule)] px-2 py-0.5 rounded-[3px]">
            NPI {npi}
          </span>
        </div>
      </div>

      <div className="mz-ambient max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Verdict — per design R-01: verdict before content. Two halves
            (integrity | issuer legitimacy) with revocation as a visible step;
            never one green banner. */}
        <Reveal variant="fade">
          <VerdictSplit
            integrity={integrityItems}
            issuer={issuerItems}
            revocation={revocationStep}
          />
        </Reveal>

        {/* ── Identity + Proof Tier Hero ─────────────────────────────────── */}
        <Reveal delay={80}>
        <div className="mz-glass rounded-[12px] p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="mz-h1">{displayName}</h1>
                {passport.lastCheckedAt && (
                  <span className="mz-mono text-[11px] text-[var(--ink-400)]">{formatUtc(passport.lastCheckedAt)}</span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[var(--ink-500)]">NPI: <span className="mz-mono text-[var(--ink-700)]">{npi}</span></span>
                {passport.identity?.specialty && (
                  <span className="text-sm text-[var(--ink-300)]">·</span>
                )}
                {passport.identity?.specialty && (
                  <span className="text-sm text-[var(--ink-500)]">{passport.identity.specialty}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`mz-chip ${
                  String(proofTier).toLowerCase().includes('decision')
                    ? 'mz-chip-ok'
                    : String(proofTier).toLowerCase().includes('partial')
                    ? 'mz-chip-watch'
                    : 'mz-chip-unknown'
                }`}
              >
                <span className="mz-gl" aria-hidden="true" />
                {tierConfig.label}
              </span>
              {passport.readiness?.score != null && (
                <span className="text-xs text-[var(--ink-500)]">
                  Readiness score:{' '}
                  <span className="font-semibold text-[var(--ink-800)]">{passport.readiness.score}</span>
                </span>
              )}
            </div>
          </div>

          {/* ── Practice location + self-reported detail. NPPES practice
              address is data the clinician self-reported TO the registry —
              labelling it green "Source-backed" overstated it (beat-TopNPI
              honesty rule): the registry entry is real, the underlying fact
              is self-reported. ── */}
          {hasProfileDetail && (
            <div className="mt-4 pt-4 border-t border-[var(--rule-soft)] space-y-3.5">
              {practiceLocationText && (
                <ProfileDetailGroup
                  title="Practice location"
                  chipLabel="Self-reported to NPPES"
                  chipClass="mz-chip-unknown"
                  rows={[practiceLocationText]}
                />
              )}
              {selfReportedEducation.length > 0 && (
                <ProfileDetailGroup
                  title="Education"
                  chipLabel="Self-reported"
                  chipClass="mz-chip-unknown"
                  rows={selfReportedEducation.map(formatEducationEntry)}
                />
              )}
              {selfReportedAffiliations.length > 0 && (
                <ProfileDetailGroup
                  title="Affiliations"
                  chipLabel="Self-reported"
                  chipClass="mz-chip-unknown"
                  rows={selfReportedAffiliations.map(formatAffiliationEntry)}
                />
              )}
            </div>
          )}
        </div>
        </Reveal>

        {/* ── Section: Provenance Strip ──────────────────────────────────── */}
        <Reveal delay={40}>
        <Section title="Source coverage">
          <ProvenanceStrip lanes={lanes} />
        </Section>
        </Reveal>

        {/* ── Section: Employer acceptances (Recognition) ────────────────── */}
        <Reveal delay={80}>
        <Section title="Employer acceptances">
          <AcceptancePanel history={acceptanceHistory} />
        </Section>
        </Reveal>

        {/* ── Section: Act on this record (employer CTA) ──────────────────
            Closes the share→accept seam: the link a clinician shares is this
            read-only page, and the decision surface is /review/[npi]. Actions
            there are Clerk-authenticated, attributable, and audited — this is
            a doorway, not a bypass. */}
        <Reveal delay={100}>
        <Section title="Reviewing this clinician for a role?">
          <div className="mz-card px-5 py-4 flex flex-wrap items-center justify-between gap-3" data-testid="employer-review-cta">
            <p className="text-sm text-[var(--ink-600)] max-w-xl">
              Employers can act on this record — accept it as a head start,
              request a source refresh, or route it to review. Decisions are
              recorded, attributable, and visible to the clinician.
            </p>
            <Link
              href={`/review/${npi}`}
              className="mz-btn shrink-0"
            >
              Open the review surface →
            </Link>
          </div>
          <p className="mz-mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-400)]">
            Requires a signed-in employer account · viewing never requires one
          </p>
        </Section>
        </Reveal>

        {/* ── Section: Receipt Verification ─────────────────────────────── */}
        <Reveal delay={120}>
        <Section title="Verification receipt">
          {firstReceiptLane ? (
            <ReceiptVerificationPane
              receiptId={firstReceiptLane.receiptId!}
              source={
                firstCheck?.sourceId ??
                firstReceiptLane.laneId
              }
              checkedAt={
                firstReceiptLane.checkedAt
                  ? new Date(firstReceiptLane.checkedAt).toISOString()
                  : '—'
              }
              algorithm="ES256"
              signingKeyId="vcv-es256-1"
              jwt={null} // JWT not serialized into page for security — verify via API
            />
          ) : (
            <EmptyState message="No verified receipts found for this NPI." />
          )}
        </Section>
        </Reveal>

        {/* ── Section: Issuer Continuity ─────────────────────────────────── */}
        <Reveal delay={160}>
        <Section title="Issuer">
          <IssuerContinuityPanel
            did="did:web:vitalcv.com"
            signingKeyId="vcv-es256-1"
          />
        </Section>
        </Reveal>

        {/* ── Section: Replay Chronology ─────────────────────────────────── */}
        <Reveal delay={200}>
        <Section title="Verification history">
          <ReplayChronologyPanel lanes={lanes} />
        </Section>
        </Reveal>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <h2 className="mz-eyebrow">
        {title}
      </h2>
      {children}
    </div>
  );
}

function TimestampField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-[var(--ink-400)]">{label}</span>
      <span className="mz-mono text-[var(--ink-700)]">{value}</span>
    </div>
  );
}

/**
 * Compact identity-detail group: a labelled provenance chip over one or more
 * plain display rows. Provenance is carried entirely by the chip — mz-chip-ok
 * for the source-backed practice location, mz-chip-unknown for the
 * self-reported education / affiliations — so a self-reported value is never
 * shown with a verified label.
 */
function ProfileDetailGroup({
  title,
  chipLabel,
  chipClass,
  rows,
}: {
  title: string;
  chipLabel: string;
  chipClass: string;
  rows: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="mz-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-400)]">
          {title}
        </span>
        <span className={`mz-chip ${chipClass}`}>
          <span className="mz-gl" aria-hidden="true" />
          {chipLabel}
        </span>
      </div>
      <ul className="space-y-0.5">
        {rows.map((row, index) => (
          <li key={`${index}-${row}`} className="text-sm text-[var(--ink-700)] break-words">
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mz-glass-inset border-dashed px-3 py-4 text-sm text-[var(--ink-400)] text-center">
      {message}
    </div>
  );
}

/**
 * Recorded employer acceptances for the reviewed NPI. Three explicit states:
 * entries, an honest zero-state, and a system-state line when the lookup
 * failed (never rendered as "no acceptances").
 */
function AcceptancePanel({
  history,
}: {
  history: EmployerAcceptanceHistoryResponse | null;
}) {
  if (!history) {
    return (
      <EmptyState message="Acceptance record temporarily unavailable. This is a system state — not a finding about this clinician." />
    );
  }

  if (!history.summary.hasPriorAcceptances) {
    return <EmptyState message="No employer acceptances recorded for this NPI." />;
  }

  return (
    <div className="mz-card divide-y divide-[var(--rule-soft)]">
      <div className="px-4 py-3.5">
        <p className="text-sm font-semibold text-[var(--ink-900)]">{history.summary.headline}</p>
        {history.summary.trustCopy && (
          <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{history.summary.trustCopy}</p>
        )}
      </div>
      {history.history.map((entry, index) => (
        <div
          key={entry.acceptanceId ?? `${entry.acceptedAt}-${index}`}
          className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <p className="text-sm text-[var(--ink-800)]">{entry.orgLabel}</p>
            {entry.acceptanceReason && (
              <p className="mt-0.5 text-xs text-[var(--ink-500)]">{entry.acceptanceReason}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
            <span className="mz-mono text-[10px] uppercase tracking-[0.06em] border border-[var(--rule)] rounded-full px-2.5 py-0.5 text-[var(--ink-600)]">
              {acceptanceScopeLabel(entry.acceptanceScope)}
            </span>
            {formatAcceptedAt(entry.acceptedAt) && <span className="mz-mono">{formatAcceptedAt(entry.acceptedAt)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotFound({ npi }: { npi: string }) {
  return (
    <div className="mz mz-paper mz-persona-verifier min-h-screen flex flex-col items-center justify-center gap-4">
      <ShieldAlert className="w-10 h-10 text-[var(--ink-300)]" />
      <div className="text-center">
        <h1 className="mz-h1">NPI not found</h1>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          No verification data available for NPI <span className="mz-mono text-[var(--ink-700)]">{npi}</span>.
        </p>
        <p className="text-xs text-[var(--ink-400)] mt-2">
          The clinician may not have initiated a VitalCV profile yet.
        </p>
      </div>
    </div>
  );
}

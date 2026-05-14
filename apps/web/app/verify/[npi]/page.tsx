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
import { Eye, ShieldAlert } from 'lucide-react';
import { ProvenanceStrip } from '@/components/verifier/ProvenanceStrip';
import { ReceiptVerificationPane } from '@/components/verifier/ReceiptVerificationPane';
import { IssuerContinuityPanel } from '@/components/verifier/IssuerContinuityPanel';
import { ReplayChronologyPanel } from '@/components/verifier/ReplayChronologyPanel';
import type { LaneSnapshot } from '@/components/proof/trust-types';
import type { PassportData } from '@/lib/trust/passport-contract';

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

async function fetchPassport(npi: string): Promise<PassportData | null> {
  try {
    const res = await fetch(
      `${BACKEND}/api/trust-proof/${encodeURIComponent(npi)}`,
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
  const passport = await fetchPassport(npi);

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

  return (
    <div className="min-h-screen bg-white">
      {/* ── Read-Only Header ───────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              Credential Verification
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
            NPI {npi}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Verdict bar — per design R-01: verdict before content */}
        <div className="border border-gray-900 bg-gray-900 rounded-lg">
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-white/60 uppercase tracking-widest">
                Verdict
              </span>
              <span className="text-sm font-mono font-semibold text-white">
                {String(proofTier).toLowerCase().includes('decision') ? 'Verifiable'
                  : String(proofTier).toLowerCase().includes('partial') ? 'Partial coverage'
                  : 'Pending'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 font-mono">
              {lanes.filter(l => l.status === 'verified').length > 0 && (
                <span>{lanes.filter(l => l.status === 'verified').length} of {lanes.length} sources confirmed</span>
              )}
              {passport.lastCheckedAt && (
                <><span className="text-white/30">|</span><span>checked {formatUtc(passport.lastCheckedAt)}</span></>
              )}
            </div>
          </div>
        </div>

        {/* ── Identity + Proof Tier Hero ─────────────────────────────────── */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-lg font-semibold text-gray-900">{displayName}</h1>
                {passport.lastCheckedAt && (
                  <span className="text-[11px] font-mono text-gray-400">{formatUtc(passport.lastCheckedAt)}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">NPI: <span className="font-mono text-gray-700">{npi}</span></span>
                {passport.identity?.specialty && (
                  <span className="text-sm text-gray-400">·</span>
                )}
                {passport.identity?.specialty && (
                  <span className="text-sm text-gray-500">{passport.identity.specialty}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-gray-900 text-white"
              >
                {tierConfig.label}
              </span>
              {passport.readiness?.score != null && (
                <span className="text-xs text-gray-500">
                  Readiness score:{' '}
                  <span className="font-semibold text-gray-800">{passport.readiness.score}</span>
                </span>
              )}
            </div>
          </div>


        </div>

        {/* ── Section: Provenance Strip ──────────────────────────────────── */}
        <Section title="Source coverage">
          <ProvenanceStrip lanes={lanes} />
        </Section>

        {/* ── Section: Receipt Verification ─────────────────────────────── */}
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

        {/* ── Section: Issuer Continuity ─────────────────────────────────── */}
        <Section title="Issuer">
          <IssuerContinuityPanel
            did="did:web:vitalcv.com"
            signingKeyId="vcv-es256-1"
          />
        </Section>

        {/* ── Section: Replay Chronology ─────────────────────────────────── */}
        <Section title="Verification history">
          <ReplayChronologyPanel lanes={lanes} />
        </Section>
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
    <div className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function TimestampField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="font-mono text-gray-700">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-gray-200 rounded px-3 py-4 text-sm text-gray-400 text-center">
      {message}
    </div>
  );
}

function NotFound({ npi }: { npi: string }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <ShieldAlert className="w-10 h-10 text-gray-300" />
      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-700">NPI not found</h1>
        <p className="text-sm text-gray-400 mt-1">
          No verification data available for NPI <span className="font-mono">{npi}</span>.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          The clinician may not have initiated a VitalCV profile yet.
        </p>
      </div>
    </div>
  );
}

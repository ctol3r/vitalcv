import Link from 'next/link';
import { fetchPilotProofSnapshot } from '@/lib/server/pilot-proof';
import type { PilotProofCounts, PilotProofSnapshot } from '@/lib/pilot-proof/types';

type PilotOrg = {
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: string;
  accepted: boolean;
  bundlesGenerated: number;
};

type PilotReport = {
  pilotOrgs: PilotOrg[];
  pilotOrgCount: number;
  isDemoMode?: boolean;
};

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeOrganizationId(
  value?: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first !== 'string') {
      return undefined;
    }
    const trimmed = first.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

async function fetchPilotReport(organizationId?: string): Promise<PilotReport | null> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/pilot/report${query}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PilotReport;
  } catch {
    return null;
  }
}

function formatActivationDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatCountDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  if (delta === 0) {
    return 'No change from baseline';
  }
  if (delta > 0) {
    return `+${delta} from baseline`;
  }
  return `${delta} from baseline`;
}

function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'Unmeasured';
  }
  return `${value}m`;
}

function metricLabel(key: keyof PilotProofCounts): string {
  switch (key) {
    case 'usersOnboarded':
      return 'Users onboarded';
    case 'readinessCompleted':
      return 'Readiness completed';
    case 'blockersResolved':
      return 'Blockers resolved';
    case 'appliedUsers':
      return 'Applied users';
    case 'applicationsSubmitted':
      return 'Applications submitted';
    case 'applicationsMoving':
      return 'Applications moving';
    case 'trustChangesSurfaced':
      return 'Trust changes surfaced';
    case 'findingsSurfaced':
      return 'Findings surfaced';
    case 'storylinesSurfaced':
      return 'Storylines surfaced';
    case 'employerReviews':
      return 'Employer reviews';
    case 'employerActionsGenerated':
      return 'Employer actions';
    default:
      return key;
  }
}

function dropOffLabel(stage: string): string {
  switch (stage) {
    case 'onboarding_started_without_completion':
      return 'Onboarding started without completion';
    case 'readiness_with_open_blockers':
      return 'Readiness still has blockers';
    case 'ready_not_applied':
      return 'Ready but not applied';
    case 'applied_still_pending':
      return 'Applied and still pending';
    case 'reviewed_awaiting_final_decision':
      return 'Reviewed without final decision';
    default:
      return stage.replace(/_/g, ' ');
  }
}

function changeLabel(summary: string): string {
  const sentence = summary.split('.')[0]?.trim();
  return sentence && sentence.length > 0 ? sentence : 'Recorded change';
}

function metricCard(
  key: keyof PilotProofCounts,
  snapshot: PilotProofSnapshot,
) {
  const currentValue = snapshot.counts[key];
  const baselineValue = (() => {
    switch (key) {
      case 'applicationsSubmitted':
        return snapshot.baselineComparison.baseline.applications;
      case 'readinessCompleted':
        return snapshot.baselineComparison.baseline.readinessCompleted;
      case 'findingsSurfaced':
        return snapshot.baselineComparison.baseline.findings;
      case 'storylinesSurfaced':
        return snapshot.baselineComparison.baseline.storylines;
      case 'employerActionsGenerated':
        return snapshot.baselineComparison.baseline.employerActionsGenerated;
      default:
        return 0;
    }
  })();

  return (
    <article className="rounded border border-neutral-200 p-4" key={key}>
      <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">{metricLabel(key)}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{currentValue}</p>
      <p className="mt-1 text-xs text-neutral-600">{formatCountDelta(currentValue, baselineValue)}</p>
    </article>
  );
}

export default async function InternalPilotsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationId = normalizeOrganizationId(resolvedSearchParams.organizationId);
  const [report, proof] = await Promise.all([
    fetchPilotReport(organizationId),
    fetchPilotProofSnapshot(),
  ]);
  const rows = report?.pilotOrgs ?? [];
  const count = report?.pilotOrgCount ?? rows.length;
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">YC pilot</p>
          <h1 className="text-3xl font-semibold">Pilot Organizations</h1>
          <p className="text-sm text-neutral-600">Pilot proof, activation records, and drop-off visibility in one readout.</p>
        </header>

        {proof ? (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                <span className="rounded border border-neutral-200 px-3 py-2">
                  Baseline established: <span className="font-semibold">{proof.baselineComparison.baselineAt ? formatActivationDate(proof.baselineComparison.baselineAt) : 'Pending'}</span>
                </span>
                <span className="rounded border border-neutral-200 px-3 py-2">
                  Snapshot generated: <span className="font-semibold">{formatActivationDate(proof.generatedAt)}</span>
                </span>
                <span className="rounded border border-neutral-200 px-3 py-2">
                  Lookback window: <span className="font-semibold">{Math.round(proof.lookbackHours / 24)} days</span>
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {metricCard('usersOnboarded', proof)}
                {metricCard('readinessCompleted', proof)}
                {metricCard('blockersResolved', proof)}
                {metricCard('applicationsSubmitted', proof)}
                {metricCard('applicationsMoving', proof)}
                {metricCard('trustChangesSurfaced', proof)}
                {metricCard('findingsSurfaced', proof)}
                {metricCard('storylinesSurfaced', proof)}
                {metricCard('employerReviews', proof)}
                {metricCard('employerActionsGenerated', proof)}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <section className="rounded border border-neutral-200 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Onboarding outcome</p>
                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                  <p>Measured users: <span className="font-semibold text-neutral-900">{proof.onboardingCompletion.sampleSize}</span></p>
                  <p>Average completion time: <span className="font-semibold text-neutral-900">{formatMinutes(proof.onboardingCompletion.averageMinutes)}</span></p>
                  <p>Median completion time: <span className="font-semibold text-neutral-900">{formatMinutes(proof.onboardingCompletion.medianMinutes)}</span></p>
                </div>
              </section>

              <section className="rounded border border-neutral-200 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Readiness outcome</p>
                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                  <p>Clinicians with snapshots: <span className="font-semibold text-neutral-900">{proof.counts.readinessCompleted}</span></p>
                  <p>Ready clinicians: <span className="font-semibold text-neutral-900">{proof.readinessProgress.readyUsers}</span></p>
                  <p>Improved clinicians: <span className="font-semibold text-neutral-900">{proof.readinessProgress.improvedUsers}</span></p>
                  <p>Average delta: <span className="font-semibold text-neutral-900">{proof.readinessProgress.averageDelta ?? 'Unmeasured'}</span></p>
                </div>
              </section>

              <section className="rounded border border-neutral-200 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Employer value signals</p>
                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                  <p>Readiness visible on applications: <span className="font-semibold text-neutral-900">{proof.counts.readinessCompleted}</span></p>
                  <p>Employer reviews recorded: <span className="font-semibold text-neutral-900">{proof.counts.employerReviews}</span></p>
                  <p>Applications moving: <span className="font-semibold text-neutral-900">{proof.counts.applicationsMoving}</span></p>
                  <p>Findings surfaced: <span className="font-semibold text-neutral-900">{proof.counts.findingsSurfaced}</span></p>
                  <p>Action queue generated: <span className="font-semibold text-neutral-900">{proof.counts.employerActionsGenerated}</span></p>
                </div>
              </section>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded border border-neutral-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">What Changed Because Of VitalCV</p>
                  <Link href="/api/internal/pilot-proof" className="text-sm underline underline-offset-4">
                    Export JSON snapshot
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {proof.recentProgress.length > 0 ? proof.recentProgress.map((change) => (
                    <div key={change.id} className="rounded border border-neutral-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{changeLabel(change.summary)}</p>
                          <p className="mt-1 text-sm text-neutral-700">{change.summary}</p>
                        </div>
                        <p className="text-xs text-neutral-500">{formatActivationDate(change.occurredAt)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-neutral-600">No recent state changes have been measured yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded border border-neutral-200 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Drop-off still visible</p>
                <div className="mt-4 space-y-3">
                  {proof.dropOff.length > 0 ? proof.dropOff.map((item) => (
                    <div key={item.stage} className="rounded border border-neutral-200 p-3">
                      <p className="text-sm font-semibold text-neutral-900">{dropOffLabel(item.stage)}</p>
                      <p className="mt-1 text-2xl font-semibold text-neutral-900">{item.count}</p>
                      <p className="mt-1 text-sm text-neutral-700">{item.detail}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-neutral-600">No measurable drop-off remains in the current pilot window.</p>
                  )}
                </div>
              </section>
            </section>

            <section className="rounded border border-neutral-200 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Proof Snapshot Export</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Recent progress</p>
                  <div className="mt-2 space-y-2 text-sm text-neutral-700">
                    <p>Pilot events in lookback: <span className="font-semibold text-neutral-900">{proof.systemActivity.pilotEvents}</span></p>
                    <p>Support issues in lookback: <span className="font-semibold text-neutral-900">{proof.systemActivity.supportIssues}</span></p>
                    <p>Route failures in lookback: <span className="font-semibold text-neutral-900">{proof.systemActivity.routeFailures}</span></p>
                    <p>Recent progress items: <span className="font-semibold text-neutral-900">{proof.recentProgress.length}</span></p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Meaningful deltas</p>
                  <div className="mt-2 space-y-2 text-sm text-neutral-700">
                    <p>Applications vs baseline: {formatCountDelta(proof.baselineComparison.current.applications, proof.baselineComparison.baseline.applications)}</p>
                    <p>Readiness completions vs baseline: {formatCountDelta(proof.baselineComparison.current.readinessCompleted, proof.baselineComparison.baseline.readinessCompleted)}</p>
                    <p>Findings vs baseline: {formatCountDelta(proof.baselineComparison.current.findings, proof.baselineComparison.baseline.findings)}</p>
                    <p>Storylines vs baseline: {formatCountDelta(proof.baselineComparison.current.storylines, proof.baselineComparison.baseline.storylines)}</p>
                    <p>Employer actions vs baseline: {formatCountDelta(proof.baselineComparison.current.employerActionsGenerated, proof.baselineComparison.baseline.employerActionsGenerated)}</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <p className="rounded border border-neutral-300 px-4 py-3 text-sm text-neutral-700">
            Pilot proof snapshot unavailable. Configure `MONITORING_SECRET` and backend internal pilot proof access.
          </p>
        )}

        {report ? (
          <>
            <div className="flex flex-wrap gap-2">
              <p className="rounded border border-neutral-200 px-3 py-2 text-sm">
                Active organizations: <span className="font-semibold">{count}</span>
              </p>
              {report.isDemoMode ? (
                <p className="rounded border border-neutral-400 px-3 py-2 text-xs uppercase tracking-[0.15em] text-neutral-600">
                  Demo Mode
                </p>
              ) : null}
            </div>

            {rows.length > 0 ? (
              <div className="overflow-x-auto border border-neutral-300">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Organization</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Contact</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Activated</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Accepted</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Bundles generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((pilot) => (
                      <tr key={pilot.id}>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.name}</td>
                        <td className="px-4 py-3 text-sm text-neutral-500">{pilot.contactEmail}</td>
                        <td className="px-4 py-3 text-sm text-neutral-500">{formatActivationDate(pilot.activatedAt)}</td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.accepted ? 'yes' : 'pending'}</td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.bundlesGenerated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                No pilot orgs have been activated yet.
              </p>
            )}
          </>
        ) : (
          <p className="rounded border border-neutral-300 px-4 py-3 text-sm text-neutral-700">
            Pilot report unavailable. Configure NEXT_PUBLIC_BACKEND_URL.
          </p>
        )}

        <div className="space-y-1 text-sm">
          <p>
            <Link href={`/internal/yc${orgQuery}`} className="underline underline-offset-4">
              Open YC dashboard
            </Link>
          </p>
          <p>
            <Link href={`/internal/metrics${orgQuery}`} className="underline underline-offset-4">
              Open raw internal metrics
            </Link>
          </p>
          <p>
            <Link href="/internal/pilot-ops" className="underline underline-offset-4">
              Open pilot ops console
            </Link>
          </p>
          <p>
            <Link href={`/internal/enterprise${orgQuery}`} className="underline underline-offset-4">
              Open enterprise signals
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

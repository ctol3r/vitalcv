import type { ProviderDetailResponse } from '@/lib/intelligence/detail-types';
import { OpsCard } from './primitives';

function formatEmploymentDate(value: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(parsed));
}

function formatEmploymentRange(startDate: string | null, endDate: string | null): string {
  const start = formatEmploymentDate(startDate);
  const end = endDate ? formatEmploymentDate(endDate) : 'Present';
  return `${start} - ${end}`;
}

export function EmploymentHistoryCard({
  employmentGraph,
}: {
  employmentGraph: ProviderDetailResponse['employmentGraph'];
}) {
  return (
    <OpsCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Employment history</h2>
          <p className="mt-1 text-sm text-[var(--vt-text-3)]">
            Grouped employer signals, current roles first, with confidence and source conflicts surfaced inline.
          </p>
        </div>
        <span className="text-sm text-[var(--vt-text-3)]">{employmentGraph.groupedEmployers.length} employers</span>
      </div>

      <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Current employers</p>
        {employmentGraph.currentEmployers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {employmentGraph.currentEmployers.map((node) => (
              <span
                key={node.id}
                className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]"
              >
                {node.verified ? '✔' : '≈'} {node.employerName}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--vt-text-3)]">No active employer signal is currently available.</p>
        )}
      </div>

      {employmentGraph.groupedEmployers.length > 0 ? (
        <div className="space-y-3">
          {employmentGraph.groupedEmployers.map((node) => (
            <div key={node.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--vt-text-1)]">
                    {node.verified ? '✔' : '≈'} {node.employerName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--vt-text-3)]">
                    {node.current ? 'Current employer' : 'Historical employer'} · {node.confidence}% confidence · {node.claims.length} signal{node.claims.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--vt-text-3)]">
                  <p>{node.verified ? 'Verified employer signal' : 'Inferred employer signal'}</p>
                  {node.latestStartDate ? <p>Latest start {formatEmploymentDate(node.latestStartDate)}</p> : null}
                </div>
              </div>

              {node.conflictFlags.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {node.conflictFlags.map((flag) => (
                    <p key={`${node.id}:${flag.kind}`} className="text-sm text-amber-300">
                      ⚠ {flag.explanation}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {node.claims.map((claim) => (
                  <div key={claim.id} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--vt-text-1)]">
                        {claim.current ? 'Current' : 'Historical'} · {claim.title ?? 'Role not specified'}
                      </p>
                      <p className="text-xs text-[var(--vt-text-3)]">{claim.confidence}% confidence</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--vt-text-2)]">{formatEmploymentRange(claim.startDate, claim.endDate)}</p>
                    <p className="mt-1 text-xs text-[var(--vt-text-3)]">
                      Source {claim.sourceId}{claim.department ? ` · ${claim.department}` : ''}
                    </p>
                    {claim.inferred ? (
                      <p className="mt-2 text-xs text-[var(--vt-text-3)]">
                        ≈ Inferred from source evidence{claim.reviewReason ? ` — ${claim.reviewReason}` : '.'}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--vt-text-3)]">No employer history was returned in the current profile data.</p>
      )}
    </OpsCard>
  );
}

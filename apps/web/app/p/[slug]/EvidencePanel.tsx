/**
 * EvidencePanel — explicit compliance evidence rendered above the NBA.
 *
 * Pulls source-coverage state for OIG, License, and Identity from the
 * publicProfile coverage payload and renders a 3-row plain-language
 * status. The Export Decision link triggers a downloadable JSON
 * artifact assembled by the backend export route.
 */

interface CoverageCheck {
  sourceId: string;
  state: string;
  reason?: string;
  checkedAt?: string | null;
}

export interface EvidenceCoverage {
  checks: CoverageCheck[];
}

interface EvidenceRowSpec {
  label: string;
  source: string; // human-readable source authority
  matches: string[];
  presentLabel: string;
  absentLabel: string;
  flaggedLabel?: string;
}

// Ordered: identity → safety → authority. Matches the progressive
// render order operators expect — establish who the person is first,
// confirm they aren't excluded second, then layer on the authority lane.
const ROWS: EvidenceRowSpec[] = [
  {
    label: 'Identity',
    source: 'NPPES Registry',
    matches: ['NPPES_API', 'NPPES'],
    presentLabel: 'Verified match',
    absentLabel: 'Missing',
  },
  {
    label: 'OIG Exclusion',
    source: 'OIG LEIE',
    matches: ['OIG_LEIE', 'OIG'],
    presentLabel: 'No exclusions found',
    absentLabel: 'Not yet checked',
    flaggedLabel: 'Possible match — review required',
  },
  {
    label: 'License Status',
    source: 'State medical board',
    matches: ['STATE_BOARD'],
    presentLabel: 'Active',
    absentLabel: 'Unknown',
  },
];

type Status = 'pass' | 'flag' | 'stale' | 'unknown';

function classify(check: CoverageCheck | undefined, spec: EvidenceRowSpec): { status: Status; label: string } {
  if (!check) return { status: 'unknown', label: spec.absentLabel };
  const state = check.state?.toLowerCase();
  if (state === 'reviewrequired' || state === 'review_required') {
    return { status: 'flag', label: spec.flaggedLabel ?? 'Review required' };
  }
  if (state === 'checked') {
    return { status: 'pass', label: spec.presentLabel };
  }
  // Stale is distinct from pending — the source was checked before but
  // the result is past its freshness window. Surface it explicitly so
  // users can make a stale-aware decision with disclosure.
  if (state === 'stale') {
    return { status: 'stale', label: 'Stale — refresh needed' };
  }
  // pending / unavailable / accessRequired / etc — treat as unknown.
  return { status: 'unknown', label: spec.absentLabel };
}

const STATUS_TONE: Record<Status, string> = {
  pass: 'text-green-700',
  flag: 'text-red-700',
  stale: 'text-amber-800',
  unknown: 'text-amber-700',
};

const STATUS_DOT: Record<Status, string> = {
  pass: 'bg-green-500',
  flag: 'bg-red-500',
  stale: 'bg-amber-600',
  unknown: 'bg-amber-400',
};

function formatVerifiedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return null;
  }
}

/** Fresh / Aging / Stale tier derived from checkedAt age. Only used
 *  when the backend state is 'checked' — stale is already its own UI
 *  state above. Aging surfaces between 14 and 30 days since last check. */
function freshnessTier(iso: string | null | undefined): 'fresh' | 'aging' | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const ageDays = (Date.now() - ts) / 86_400_000;
  if (ageDays < 14) return 'fresh';
  if (ageDays <= 30) return 'aging';
  // Older than 30 days but backend still says checked — treat as aging
  // for UI purposes; backend is expected to flip to 'stale' past its
  // own freshness window.
  return 'aging';
}

export function EvidencePanel({
  coverage,
  npi,
}: {
  coverage: EvidenceCoverage | undefined | null;
  npi?: string;
}) {
  const checks = coverage?.checks ?? [];
  const findCheck = (matches: string[]): CoverageCheck | undefined =>
    checks.find((c) => matches.includes(c.sourceId));

  const rowStatuses = ROWS.map((spec) => classify(findCheck(spec.matches), spec));
  const hasStale = rowStatuses.some((r) => r.status === 'stale');

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Compliance evidence
      </p>
      {hasStale && (
        <div
          role="status"
          className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800"
        >
          <p>
            <span className="font-semibold">One or more sources are stale.</span>{' '}
            Impact: the lane may no longer reflect the current status at the issuing
            authority. Proceeding now relies on the last verified snapshot below.
          </p>
          <p className="mt-1">
            Recommended action: <span className="font-semibold">request a fresh check</span>{' '}
            (the Run Fresh Verification action above) before acting. If you proceed, the
            action is recorded against the stale snapshot with explicit disclosure.
          </p>
        </div>
      )}
      <ul className="mt-3 divide-y divide-border">
        {ROWS.map((spec) => {
          const check = findCheck(spec.matches);
          const { status, label } = classify(check, spec);
          const verifiedAt = formatVerifiedAt(check?.checkedAt);
          // Three-tier freshness. 'stale' is already a distinct status
          // (surfaced by classify); for 'pass', derive Fresh/Aging from
          // the checkedAt age so the user sees data-age context next to
          // the status.
          const tier = status === 'pass' ? freshnessTier(check?.checkedAt) : null;
          return (
            <li
              key={spec.label}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {spec.label}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    · {spec.source}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {verifiedAt ? `Last verified: ${verifiedAt}` : 'Verification pending'}
                  {tier === 'fresh' && (
                    <span className="ml-2 font-semibold text-green-700">· Fresh</span>
                  )}
                  {tier === 'aging' && (
                    <span className="ml-2 font-semibold text-amber-700">· Aging</span>
                  )}
                  {status === 'stale' && (
                    <span className="ml-2 font-semibold text-amber-800">· Stale</span>
                  )}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-2 text-sm font-semibold ${STATUS_TONE[status]}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
                {label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] italic text-muted-foreground">
        All checks performed against primary sources.
      </p>
      {npi && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a
            href={`/api/export/${encodeURIComponent(npi)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <span aria-hidden>↗</span> View full evidence snapshot
          </a>
          <a
            href={`/api/export/${encodeURIComponent(npi)}?download=1`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            download
          >
            <span aria-hidden>↓</span> Export Decision
          </a>
        </div>
      )}
    </div>
  );
}

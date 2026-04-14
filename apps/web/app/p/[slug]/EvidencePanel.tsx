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

const ROWS: EvidenceRowSpec[] = [
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
  {
    label: 'Identity',
    source: 'NPPES Registry',
    matches: ['NPPES_API', 'NPPES'],
    presentLabel: 'Verified match',
    absentLabel: 'Missing',
  },
];

type Status = 'pass' | 'flag' | 'unknown';

function classify(check: CoverageCheck | undefined, spec: EvidenceRowSpec): { status: Status; label: string } {
  if (!check) return { status: 'unknown', label: spec.absentLabel };
  const state = check.state?.toLowerCase();
  if (state === 'reviewrequired' || state === 'review_required') {
    return { status: 'flag', label: spec.flaggedLabel ?? 'Review required' };
  }
  if (state === 'checked') {
    return { status: 'pass', label: spec.presentLabel };
  }
  // pending / stale / unavailable / etc — treat as unknown.
  return { status: 'unknown', label: spec.absentLabel };
}

const STATUS_TONE: Record<Status, string> = {
  pass: 'text-green-700',
  flag: 'text-red-700',
  unknown: 'text-amber-700',
};

const STATUS_DOT: Record<Status, string> = {
  pass: 'bg-green-500',
  flag: 'bg-red-500',
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Compliance evidence
      </p>
      <ul className="mt-3 divide-y divide-border">
        {ROWS.map((spec) => {
          const check = findCheck(spec.matches);
          const { status, label } = classify(check, spec);
          const verifiedAt = formatVerifiedAt(check?.checkedAt);
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
                  {verifiedAt ? `Verified at: ${verifiedAt}` : 'Verification pending'}
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
        <div className="mt-4 flex justify-end">
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

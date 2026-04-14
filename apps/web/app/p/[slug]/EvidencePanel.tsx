/**
 * EvidencePanel — explicit compliance evidence rendered above the NBA.
 *
 * Pulls source-coverage state for OIG, License, and Identity from the
 * publicProfile coverage payload and renders a 3-row plain-language
 * status. Pure presentation; no hooks, no interactivity.
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
  matches: string[];
  presentLabel: string;
  absentLabel: string;
  flaggedLabel?: string;
}

const ROWS: EvidenceRowSpec[] = [
  {
    label: 'OIG Exclusion',
    matches: ['OIG_LEIE', 'OIG'],
    presentLabel: 'Clear',
    absentLabel: 'Not yet checked',
    flaggedLabel: 'Flagged',
  },
  {
    label: 'License Status',
    matches: ['STATE_BOARD'],
    presentLabel: 'Active',
    absentLabel: 'Unknown',
  },
  {
    label: 'Identity',
    matches: ['NPPES_API', 'NPPES'],
    presentLabel: 'Verified',
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

export function EvidencePanel({ coverage }: { coverage: EvidenceCoverage | undefined | null }) {
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
          return (
            <li
              key={spec.label}
              className="flex items-baseline justify-between gap-3 py-2.5"
            >
              <span className="text-sm font-medium text-foreground">{spec.label}</span>
              <span className={`flex items-center gap-2 text-sm font-semibold ${STATUS_TONE[status]}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

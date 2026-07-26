/**
 * TruthBoundary — "What VitalCV knows" and, more importantly, what it does not.
 *
 * Extracted from EvidenceTruthPanel when that panel was retired from the
 * homepage composition. The panel was redundant (it restated HomeProofMoment's
 * argument immediately after it, costing ~811px and a second H2) — but it was
 * also the ONLY place carrying the enumerated limitation:
 *
 *     "not a completed credentialing, privileging, or employer clearance
 *      decision. Institution review remains the final step."
 *
 * Dropping the panel silently dropped that sentence from the page. A section
 * being redundant as ARGUMENT does not make its disclaimers redundant as
 * GUARANTEES, so the boundary moves here and mounts under the surviving proof
 * section instead of disappearing with the wrapper it happened to live in.
 *
 * EvidenceTruthPanel still renders this same component, so the two can never
 * drift apart.
 */

type Tone = 'confirmed' | 'gated' | 'attested' | 'unknown';

const TONE_DOT: Record<Tone, string> = {
  confirmed: 'var(--vt-accent-emerald)',
  gated: 'var(--vt-state-stale, #a2670b)',
  attested: 'var(--vt-text-secondary)',
  unknown: 'var(--vt-text-muted)',
};

const BOUNDARY: ReadonlyArray<{ label: string; tone: Tone; items: string[] }> = [
  { label: 'Source-backed', tone: 'confirmed', items: ['NPI identity', 'Practice taxonomy', 'Practice location'] },
  { label: 'Checked', tone: 'confirmed', items: ['Federal exclusion source (OIG / LEIE)'] },
  { label: 'Access required', tone: 'gated', items: ['State license status'] },
  { label: 'Self-attested', tone: 'attested', items: ['Preferred location', 'Compensation expectations'] },
  { label: 'Not yet known', tone: 'unknown', items: ['Current employer standing', 'Institution credentialing decision'] },
];

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: TONE_DOT[tone] }}
    />
  );
}

export function TruthBoundary({ className }: { className?: string }) {
  return (
    <div
      data-home-truth-boundary=""
      className={
        className ??
        'rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-6 py-6'
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
        What VitalCV knows
      </p>
      <ul className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {BOUNDARY.map((g) => (
          <li key={g.label}>
            <div className="flex items-center gap-2">
              <Dot tone={g.tone} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--vt-text-secondary)]">
                {g.label}
              </span>
            </div>
            <p className="mt-1 pl-4 text-[14px] leading-relaxed text-[var(--vt-text-primary)]">
              {g.items.join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-[8px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
          What this does not mean
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
          This is not a completed credentialing, privileging, or employer clearance decision.
          Institution review remains the final step.
        </p>
      </div>
    </div>
  );
}

export default TruthBoundary;

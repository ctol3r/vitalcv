import { cn } from '@/lib/utils';

/**
 * EvidenceInspector — the reference implementation of CD-14's evidence artifact.
 *
 * "The most disciplined surface in the product… It should read as if it could be
 * printed and filed." CD-14 also says: if you only ever fix one screen, fix this
 * one — it is what an employer screenshots and forwards.
 *
 * The rules this surface obeys, all of them structural rather than stylistic:
 *
 *  - **Every asserted fact carries source and age** (CD-2.2: glyph + word +
 *    source + age). `source` and `asOf` are REQUIRED on {@link EvidenceFact} —
 *    an unattributed fact is a compile error, not a review comment. That is
 *    CD-16.3's intent expressed in the type.
 *  - **Machine facts are mono** (CD-8). Values, sources and timestamps render in
 *    `--vt-font-mono`; prose does not. Mono is the signal that a value was
 *    RETRIEVED rather than written, and it is the cheapest durable way to make
 *    the product feel verifiable. Nine of the fourteen reference sites measured
 *    on 2026-08-01 ship a single type family and cannot make this distinction
 *    at all.
 *  - **No glass, blur, gradient, shadow or glow** (CD-12, CD-10). Structure is
 *    hairline rules. Light-mode evidence surfaces have no shadow.
 *  - **No motion at all** (CD-14). Not reduced motion — none.
 *  - **The limit is stated.** `doesNotDecide` is rendered, not optional prose in
 *    a tooltip. An artifact that does not say what it refuses to decide is
 *    exactly the over-claim CD-1 forbids.
 */
export interface EvidenceFact {
  /** What the fact is called. Human prose → sans. */
  label: string;
  /** What the source returned. Machine fact → mono (CD-8). */
  value: string;
  /** REQUIRED. The named source. An unattributed fact cannot be constructed. */
  source: string;
  /** REQUIRED. ISO timestamp or a dated snapshot label. */
  asOf: string;
  /** Optional note — e.g. the refresh window this lane actually runs on. */
  note?: string;
}

export interface EvidenceInspectorProps {
  title: string;
  /** Optional record identifier — NPI, receipt id. Rendered mono. */
  recordId?: string;
  facts: EvidenceFact[];
  /** What this artifact explicitly does NOT decide. Rendered, never hidden. */
  doesNotDecide?: string;
  className?: string;
}

export function EvidenceInspector({
  title,
  recordId,
  facts,
  doesNotDecide,
  className,
}: EvidenceInspectorProps) {
  return (
    <article
      className={cn(
        // CD-10: an evidence artifact is a document → 3px, and structure comes
        // from a rule, not a shadow. `--rule-strong` on the top edge is the
        // artifact's masthead.
        'rounded-[3px] border border-[var(--vt-border)] border-t-2 border-t-[var(--vt-text-muted)]',
        'bg-[var(--vt-surface)] p-[var(--vt-space-16)]',
        className,
      )}
    >
      <header className="mb-[var(--vt-space-12)] flex flex-wrap items-baseline justify-between gap-[var(--vt-space-8)]">
        <h3 className="m-0 text-[1.125rem] font-[var(--vt-font-weight-medium)] leading-[1.3] text-[var(--vt-text-primary)]">
          {title}
        </h3>
        {recordId ? (
          <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.8125rem] tabular-nums text-[var(--vt-text-muted)]">
            {recordId}
          </span>
        ) : null}
      </header>

      {/* Full-bleed to its rule, not inset in a padded card (CD-10). */}
      <dl className="m-0 border-t border-[var(--vt-border)]">
        {facts.map((fact) => (
          <div
            key={`${fact.label}-${fact.source}`}
            className="grid gap-x-[var(--vt-space-16)] gap-y-[var(--vt-space-4)] border-b border-[var(--vt-border)] py-[var(--vt-space-12)] sm:grid-cols-[minmax(0,14ch)_1fr]"
          >
            <dt className="text-[0.8125rem] leading-[1.4] text-[var(--vt-text-secondary)]">
              {fact.label}
            </dt>
            <dd className="m-0 flex flex-col gap-[var(--vt-space-4)]">
              {/* CD-8 — the retrieved value. */}
              <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.8125rem] leading-[1.5] tabular-nums text-[var(--vt-text-primary)]">
                {fact.value}
              </span>
              {/* CD-2.2 — source and age, always, in mono because both are
                  machine facts. Remove all colour and this line still says who
                  said it and when. */}
              <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] leading-[1.4] tracking-[0.04em] text-[var(--vt-text-muted)]">
                {fact.source} · {fact.asOf}
              </span>
              {fact.note ? (
                <span className="text-[0.75rem] leading-[1.5] text-[var(--vt-text-muted)]">
                  {fact.note}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {doesNotDecide ? (
        <p className="mt-[var(--vt-space-12)] max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]">
          <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
            Does not decide
          </span>
          <br />
          {doesNotDecide}
        </p>
      ) : null}
    </article>
  );
}

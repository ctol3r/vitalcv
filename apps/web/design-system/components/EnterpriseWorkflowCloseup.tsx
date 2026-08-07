import { cn } from '@/lib/utils';

/**
 * EnterpriseWorkflowCloseup — a framed close-up of one of OUR OWN artifacts,
 * with a caption saying what it is and what it is not.
 *
 * Reference: Palantir's operational close-ups, measured 2026-08-01. What is
 * adopted is the *composition* — a tight crop on real product, captioned, given
 * room. What is NOT adopted is the material: Palantir's home autoplays six muted
 * loops, Medallion ships 150 still images of dashboards and award badges, and
 * hireEZ ships 235 images against 2 SVGs.
 *
 * CD-13 settles that: "the only images VitalCV publishes are **its own
 * artifacts** — a real proof packet, a real source result, a real requirement
 * ledger, rendered honestly and legibly. That is the entire art direction."
 *
 * So this frames a LIVE React artifact, not a screenshot. That is the point: a
 * screenshot of a dashboard can imply a live result it cannot support, whereas
 * rendering the real component means the close-up is subject to the same truth
 * contract as the surface it came from. Dock's diagram-led explanation
 * (38–51 SVG, zero video across six pages) is the nearest reference and the same
 * instinct.
 *
 * `illustrative` exists because the homepage contract requires it: an artifact
 * shown as an example rather than as a live read must carry a visible
 * "Illustrative — not a live result" note. Defaulting it to `true` makes the
 * honest case the easy one; claiming a live result has to be deliberate.
 */
export interface EnterpriseWorkflowCloseupProps {
  /** What the reader is looking at. */
  caption: string;
  /** The real artifact — an EvidenceInspector, a receipt, a requirement ledger. */
  children: React.ReactNode;
  /**
   * Whether this is an example rather than a live read. Defaults to `true`:
   * the honest label is the default, and asserting live is the opt-in.
   */
  illustrative?: boolean;
  className?: string;
}

export function EnterpriseWorkflowCloseup({
  caption,
  children,
  illustrative = true,
  className,
}: EnterpriseWorkflowCloseupProps) {
  return (
    <figure className={cn('m-0 flex flex-col gap-[var(--vt-space-8)]', className)}>
      {/* Inset paper so the artifact reads as lifted out of a page, using a rule
          rather than a shadow — CD-12 forbids elevation theatre on evidence. */}
      <div className="rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-[var(--vt-space-16)]">
        {children}
      </div>

      <figcaption className="flex flex-col gap-[var(--vt-space-4)]">
        <span className="max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]">
          {caption}
        </span>
        {illustrative ? (
          <span className="font-[family-name:var(--vt-font-mono)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
            Illustrative — not a live result
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

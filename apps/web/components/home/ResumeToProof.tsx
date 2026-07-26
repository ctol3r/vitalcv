import * as React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * ResumeToProof — the deck's sharpest line, as a three-panel visual:
 *   A résumé says "I am qualified." → VitalCV says "Here is the proof." →
 *   so the employer can act faster.
 *
 * Honesty: "Here is the proof" means source-backed evidence with its state
 * attached — not a completion or credentialing claim. The dark middle panel is
 * the one solid technical surface (matches EvidenceTruthPanel's register).
 */
export function ResumeToProof() {
  return (
    <section aria-label="From résumé to proof" data-home-resume-proof="" className="mz pt-14">
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.1fr_auto_1fr]">
        <figure className="flex flex-col justify-center rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-6 py-7">
          <figcaption className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
            A résumé says
          </figcaption>
          <p className="mt-2 text-[clamp(22px,3vw,30px)] font-medium leading-tight text-[var(--vt-text-primary)]" style={{ fontFamily: 'var(--mz-serif)' }}>
            &ldquo;I am qualified.&rdquo;
          </p>
        </figure>

        <div aria-hidden="true" className="flex items-center justify-center text-[var(--vt-text-muted)]">
          <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>

        <figure
          className="flex flex-col justify-center rounded-[14px] border px-6 py-7"
          style={{ backgroundColor: 'var(--ink-900, #0f1417)', borderColor: 'rgba(255,255,255,0.10)' }}
        >
          <figcaption className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            VitalCV says
          </figcaption>
          <p className="mt-2 text-[clamp(22px,3vw,30px)] font-medium leading-tight" style={{ color: '#f4f2ec', fontFamily: 'var(--mz-serif)' }}>
            &ldquo;Here is the proof.&rdquo;
          </p>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Source-backed evidence, each field carrying its state.
          </p>
        </figure>

        <div aria-hidden="true" className="flex items-center justify-center text-[var(--vt-text-muted)]">
          <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>

        <figure className="flex flex-col justify-center rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-6 py-7">
          <figcaption className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
            So the employer can
          </figcaption>
          <p className="mt-2 text-[clamp(22px,3vw,30px)] font-medium leading-tight text-[var(--vt-text-primary)]" style={{ fontFamily: 'var(--mz-serif)' }}>
            act faster.
          </p>
        </figure>
      </div>
    </section>
  );
}

export default ResumeToProof;

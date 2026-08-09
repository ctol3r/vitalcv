import type { Metadata } from 'next';

import {
  ClinicianFigure,
  ConsentGate,
  IllustrationLabel,
  LivingRecord,
  RelationshipScene,
  ReviewDesk,
  SourceKiosk,
} from '@/components/vital/record';
import { IMPLEMENTED_FACES } from '@/components/vital/record/anatomy';

/**
 * /design/living-record — the ILL-03 kit and the ILL-04/05 relationship scene.
 *
 * Design reference only. Gated by the /design layout (404 in canonical
 * production), noindex, self-chromed like every /design reference.
 *
 * Why this is here and not on `/`: the EC-28 placement note forecloses a
 * relationship scene on the homepage without an EC-22 amendment and a founder
 * visual gate, and `/` already tells this story twice — the WorkSurface
 * (manifest §2) and UX-04's ProcessStory (manifest §4). Adding a third telling
 * is a consolidation decision for the founder, not something an illustration
 * wave should take. See docs/design/illustrated-journey-baseline.md §4.2.
 *
 * Accessibility shape: every record, kiosk, gate, figure and desk is
 * aria-hidden artwork. The scene's live transcript and the numbered story below
 * carry the meaning as ordinary prose, so deleting every illustration on this
 * page leaves it fully explaining itself — the property EC-26 requires.
 */
export const metadata: Metadata = {
  title: 'Living Evidence Record — design reference',
  robots: { index: false, follow: false },
};

const STORY: Array<{ step: string; body: string }> = [
  {
    step: 'The record begins with you',
    body: 'The record is yours. It exists before any employer is involved, and it stays with you afterwards — including into your next move.',
  },
  {
    step: 'Trusted sources add facts',
    body: 'Each source contributes one fact it can actually answer for, with the date it answered and the edge of what it covers. A training record is not a licence; a licensing board answers only for its own state. No source certifies you as a whole person.',
  },
  {
    step: 'What no source can answer stays open',
    body: 'Open slots stay visibly open rather than being hidden or filled in with a guess. Some things — where you want to work, why you left a role — only you can tell, and they are marked as yours rather than dressed up as source-backed.',
  },
  {
    step: 'You choose what leaves it',
    body: 'Nothing crosses the gate until you approve it. The approval sits over the facts as a separate layer, because it is a decision about facts rather than a fact itself. Rows you hold back are absent from what is sent — not greyed out, not sent-but-hidden.',
  },
  {
    step: 'The employer reviews, and decides',
    body: 'What arrives is the same record with less of it, not a different document. The employer can read it, ask you for what is still open, and make their own decision. VitalCV does not verify, clear, credential, or hire anyone, and nothing on this page has been decided.',
  },
];

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--vt-scene-text-secondary)]">
        {label}
      </span>
      {/* Wraps: at 390 the three kiosks side by side squeezed their labels to
          "A TRAINING REC…". A specimen row that clips its own specimens is
          not a reference. */}
      <div className="flex flex-wrap items-stretch gap-3">{children}</div>
    </div>
  );
}

export default function LivingRecordHarness() {
  return (
    <main className="min-h-screen bg-[var(--vt-scene-canvas)] px-5 py-12 sm:px-8">
      <header className="mx-auto max-w-5xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--vt-scene-text-tertiary)]">
          VitalCV · Illustrated Journey · ILL-03 kit + ILL-04/05 scene
        </p>
        <h1 className="mt-2.5 text-[28px] font-medium leading-tight text-[var(--vt-scene-text)]">
          One record, three actors
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--vt-scene-text-secondary)]">
          The clinician owns and controls the record. Trusted sources contribute individual facts
          with known limits. VitalCV assembles and labels. The employer receives only what the
          clinician selected — and makes its own review decision. The object&rsquo;s anatomy is the
          one already ratified in the Z0 storyboard: same protagonist, not a second one.
        </p>
        <IllustrationLabel className="mt-3" />
      </header>

      {/* ── ILL-04 / ILL-05: the relationship ─────────────────────────────── */}
      <section aria-labelledby="relationship" className="mx-auto mt-12 max-w-5xl">
        <h2 id="relationship" className="sr-only">
          The relationship
        </h2>
        <RelationshipScene />

        <div className="mt-10 border-t border-[var(--vt-scene-line)] pt-6">
          <h3 className="text-[13px] font-semibold text-[var(--vt-scene-text)]">
            What the illustration says, in words
          </h3>
          <ol className="mt-4 flex list-none flex-col gap-4 p-0">
            {STORY.map((item, i) => (
              <li key={item.step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                <span className="font-mono text-[11px] text-[var(--vt-scene-text-tertiary)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--vt-scene-text)]">
                    {item.step}
                  </p>
                  <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--vt-scene-text-secondary)]">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── ILL-03: the kit ───────────────────────────────────────────────── */}
      <section aria-labelledby="kit" className="mx-auto mt-14 max-w-5xl">
        <h2 id="kit" className="text-[16px] font-semibold text-[var(--vt-scene-text)]">
          The kit
        </h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--vt-scene-text-secondary)]">
          Every primitive routes through the scene tokens. There is no state hue anywhere in the
          artwork: an illustration in which no source has answered may not carry a mark that says
          one did.
        </p>

        <div className="mt-6 flex flex-col gap-9">
          <Specimen label="Issuer kiosks — arch, cabinet, seal">
            <SourceKiosk kind="training" className="max-w-[190px]" />
            <SourceKiosk kind="licensing" className="max-w-[190px]" />
            <SourceKiosk kind="certification" className="max-w-[190px]" />
          </Specimen>

          <Specimen label="Consent gate, holder, and the record">
            <ClinicianFigure />
            <LivingRecord face="returned" />
            <ConsentGate />
            <LivingRecord face="arrived" variant="recipient" />
          </Specimen>

          <Specimen label="Review desk — receives, never resolves">
            <ReviewDesk className="max-w-[260px]" />
          </Specimen>
        </div>

        <h3 className="mt-10 text-[13px] font-semibold text-[var(--vt-scene-text)]">The faces</h3>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--vt-scene-text-secondary)]">
          Same silhouette, same top-edge asymmetry, same spine throughout — only fill, layer and
          crop change. Side by side they must read as one object; if any two look like different
          components, the kit has failed its own test.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {IMPLEMENTED_FACES.map((face) => (
            <LivingRecord key={face} face={face} caption={face} />
          ))}
        </div>
      </section>
    </main>
  );
}

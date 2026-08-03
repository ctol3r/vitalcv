/**
 * /design/z1-home — Z1 first visible slice (founder preview)
 *
 * FIVE-SECOND TEST: a first-time visitor must understand, from the first
 * viewport's visuals alone, that VitalCV turns an NPI into a reusable
 * clinician profile, connects it to an opportunity, hands the employer the
 * information, and the clinician starts sooner. The hero therefore carries
 * ONE headline, ONE short support line, ONE activation instrument, and one
 * connected product story — not paragraphs.
 *
 * The Living Evidence Record is the proof layer inside that story (the
 * employer-packet stage renders the canonical SEALED face), not the whole
 * story. Faces come from components/evidence-record/faces.mjs — the same
 * module the approved Z0 package builds from.
 *
 * Gated like every /design/* surface: the shared layout 404s this route in
 * canonical production, so the public homepage is untouched.
 *
 * Design Handoff References:
 *   artifacts/zoox-fidelity-z0/z0-evidence-package.md
 *   artifacts/zoox-fidelity-z0/acceptance-matrix.md
 */

import type { Metadata } from 'next';

import { NpiActivation } from '@/components/evidence-record/NpiActivation';
import { StoryChapters } from '@/components/evidence-record/StoryChapters';
// Canonical object stylesheet + this route's composition. Order matters:
// composition may steer the object but never restate its rules.
import '@/components/evidence-record/record.css';
import '@/styles/z1-home.css';

import { FACES } from '@/components/evidence-record/faces.mjs';

export const metadata: Metadata = {
  title: 'Z1 · First visible slice — founder preview',
  description: 'Preview of the VitalCV homepage direction: NPI activation, the reusable clinician profile, and the career loop.',
  robots: { index: false, follow: false },
};

/* One short label + one short line per stage — the loop is a picture of the
 * same profile moving, not five paragraphs. */
export default function Z1HomePreviewPage() {
  // SEALED at packet scale: the employer receives permissioned information —
  // which is exactly what the sealed record states.
  const sealedFace = FACES.SEALED('var(--z1-packet, 340)', 'hero');
  /* Chapter three's two sides, from the same canonical module: the clinician's
   * review of what travels, and what the employer can actually see. */
  const decidingFace = FACES.DECIDING('var(--z1-review, 430)', 'hero');
  const returnedFace = FACES.RETURNED('var(--z1-packet2, 470)', 'hero');

  // The navigation shell is the REAL global chrome: RootChrome renders the
  // production Navbar because this route is registered as a public surface.
  return (
    <div className="z1-page evr-scene">
      <main>
        <section className="z1-hero" aria-label="Start with your NPI">
          <div className="z1-arg">
            <h1 className="z1-headline">
              Get hired for the right opportunity—and start <em>sooner</em>.
            </h1>
            <p className="z1-support">
              Build a reusable clinician profile from your NPI, apply with it,
              and give employers a head start.
            </p>
            <NpiActivation sealedFace={sealedFace} />
          </div>
        </section>

        <StoryChapters decidingFace={decidingFace} returnedFace={returnedFace} />
      </main>
    </div>
  );
}

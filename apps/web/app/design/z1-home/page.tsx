/**
 * /design/z1-home — Z1 first visible slice (founder preview)
 *
 * The first browser-clickable slice of the Zoox-fidelity homepage direction:
 * the real global Navbar, the clinician-first hero with the founder-approved
 * narrative, the primary NPI activation control (simulated resolution,
 * labelled as such on the surface), ONE integrated Living Evidence Record
 * scene, and the five-stage career loop.
 *
 * The record renders from components/evidence-record/faces.mjs — the SAME
 * module the approved Z0 sheets, storyboards and animatics build from. This
 * page composes the approved object; it does not reimplement it.
 *
 * Gated like every /design/* surface: the shared layout 404s this route in
 * canonical production, so the public homepage is untouched. Dev serves it
 * always; a local or Railway preview build needs DESIGN_PREVIEW=1.
 *
 * Design Handoff References:
 *   artifacts/zoox-fidelity-z0/z0-evidence-package.md
 *   artifacts/zoox-fidelity-z0/acceptance-matrix.md
 *   artifacts/zoox-fidelity-z0/treatments/build-scale-scene.mjs (scene values)
 */

import type { Metadata } from 'next';

import { NpiActivation } from '@/components/evidence-record/NpiActivation';
// Canonical object stylesheet + this route's composition. Order matters:
// composition may steer the object (--z1-rec) but never restate its rules.
import '@/components/evidence-record/record.css';
import '@/styles/z1-home.css';

// The faces module is plain ESM shared with the Z0 artifacts. Server-only:
// the HTML strings are rendered here and handed to the client island, which
// swaps them but never builds record markup of its own.
import { FACES } from '@/components/evidence-record/faces.mjs';

export const metadata: Metadata = {
  title: 'Z1 · First visible slice — founder preview',
  description: 'Preview of the Zoox-fidelity homepage direction: hero, NPI activation, the Living Evidence Record, and the career loop.',
  robots: { index: false, follow: false },
};

/* The record's width is steered by the composition via --z1-rec (the scene
 * owns scale; the object owns itself). The var() flows through the face's
 * inline --wn so one server render recomposes at every breakpoint. */
const REC_WIDTH = 'var(--z1-rec, 680)';

const LOOP = [
  { name: 'Discover', desc: 'Find a better opportunity, matched on evidence.' },
  { name: 'Apply', desc: 'Apply with VitalCV — your record travels with permission.' },
  { name: 'Get hired', desc: 'Employers decide on source-backed information.' },
  { name: 'Start sooner', desc: 'Less re-collection between offer and first shift.' },
  { name: 'Keep your record', desc: 'Your evidence stays yours for the next move.' },
] as const;

export default function Z1HomePreviewPage() {
  const faces = {
    blank: FACES.BLANK(REC_WIDTH, 'hero'),
    writing: FACES.WRITING(REC_WIDTH, 'hero'),
    resolving: FACES.RESOLVING(REC_WIDTH, 'hero'),
    returned: FACES.RETURNED(REC_WIDTH, 'hero'),
  };

  // The navigation shell is the REAL global chrome: RootChrome renders the
  // production Navbar because this route is registered as a public surface in
  // publicSurfaceRoutes.ts. Rendering a second one here would double it.
  return (
    <div className="z1-page evr-scene">
      <main>
        <section className="z1-hero" aria-label="Start with your NPI">
          <div className="z1-intro">
            <p className="z1-eyebrow">For clinicians</p>
            <h1 className="z1-headline">
              Get hired for the right opportunity—and start <em>sooner</em>.
            </h1>
            <p className="z1-support">
              VitalCV gives clinicians a reusable career profile built from the
              information employers need, so every new application does not have
              to start from zero.
            </p>
          </div>
          <NpiActivation faces={faces} />
        </section>

        <section className="z1-loop" aria-label="The VitalCV career loop">
          <div className="z1-loop-inner">
            <h2 className="z1-loop-title">The career loop</h2>
            <ol className="z1-loop-track">
              {LOOP.map((stage, i) => (
                <li key={stage.name} className="z1-stage-item">
                  <span className="z1-stage-n">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="z1-stage-name">{stage.name}</span>
                    <span className="z1-stage-desc">{stage.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="z1-loop-return">
              05 → 01 · the record you keep is what discovers the next opportunity
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

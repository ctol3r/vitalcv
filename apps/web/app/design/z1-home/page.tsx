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
import { Archive, BadgeCheck, CalendarClock, Compass, Send } from 'lucide-react';

import { NpiActivation } from '@/components/evidence-record/NpiActivation';
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
const LOOP = [
  { name: 'Discover', desc: 'A better opportunity finds your profile.', Icon: Compass },
  { name: 'Apply', desc: 'Your profile travels with permission.', Icon: Send },
  { name: 'Get hired', desc: 'Decided on source-backed information.', Icon: BadgeCheck },
  { name: 'Start sooner', desc: 'Less re-collection before day one.', Icon: CalendarClock },
  { name: 'Keep your record', desc: 'It stays yours for the next move.', Icon: Archive },
] as const;

export default function Z1HomePreviewPage() {
  // SEALED at packet scale: the employer receives permissioned information —
  // which is exactly what the sealed record states.
  const sealedFace = FACES.SEALED('var(--z1-packet, 340)', 'hero');

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

        <section className="z1-loop" aria-label="The VitalCV career loop">
          <div className="z1-loop-inner">
            <h2 className="z1-loop-title">One profile, the whole loop</h2>
            <ol className="z1-loop-track">
              {LOOP.map(({ name, desc, Icon }) => (
                <li key={name} className="z1-stage-item">
                  <span className="z1-stage-glyph" aria-hidden="true"><Icon /></span>
                  <span className="z1-stage-name">{name}</span>
                  <span className="z1-stage-desc">{desc}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * The Z1 homepage story — ONE component, served by '/' (the production
 * homepage, founder-directed 2026-08-03) and by /preview/home (the noindex
 * alias the founder reviewed on). One definition so the homepage and its
 * preview cannot drift.
 *
 * Server component: the record faces render here from the canonical module
 * and hydrate only the interactive islands (NpiActivation, StoryChapters).
 */

import { NpiActivation } from '@/components/evidence-record/NpiActivation';
import { StoryChapters } from '@/components/evidence-record/StoryChapters';
// Canonical object stylesheet + the route composition. Order matters: the
// composition may steer the object but never restate its rules. The z1-*
// keyframes live in the house motion file (LINT-03), so it loads too.
import '@/components/evidence-record/record.css';
import '@/styles/motion.css';
import '@/styles/z1-home.css';

import { FACES } from '@/components/evidence-record/faces.mjs';

export function Z1Home() {
  // SEALED at packet scale: the employer receives permissioned information —
  // which is exactly what the sealed record states.
  const sealedFace = FACES.SEALED('var(--z1-packet, 340)', 'hero');
  /* Chapter three's two sides, from the same canonical module: the clinician's
   * review of what travels, and what the employer can actually see. */
  const decidingFace = FACES.DECIDING('var(--z1-review, 430)', 'hero');
  const returnedFace = FACES.RETURNED('var(--z1-packet2, 470)', 'hero');


  return (
    <div className="z1-page evr-scene">
      <main>
        {/* data-home-hero is the deploy-smoke + post-deploy contract marker:
            scripts/deploy-smoke.mjs greps it from the production homepage and
            deploy-web.yml waits on it. It rides the hero, whatever the hero is. */}
        <section className="z1-hero" data-home-hero aria-label="Start with your NPI">
          <div className="z1-arg">
            <h1 className="z1-headline">
              Get hired for the right opportunity—and start <em>sooner</em>.
            </h1>
            <p className="z1-support">
              Build a reusable clinician profile from your NPI, apply with it,
              and give employers a head start.
            </p>

            <NpiActivation sealedFace={sealedFace} />
          {/* The buyer's door: distinct, secondary, after the primary NPI
              action (SHD-2.2 — dual audience on one artifact). */}
          <p className="z1-employer-entry">
            Hiring?{' '}
            <a data-home-employer-cta href="/employers">See what employers receive →</a>
          </p>
          </div>
        </section>

        <StoryChapters decidingFace={decidingFace} returnedFace={returnedFace} />
      </main>
    </div>
  );
}

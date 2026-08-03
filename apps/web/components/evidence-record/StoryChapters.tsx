'use client';

/**
 * Z1 chapters two and three — Discover (MATCHA) and Apply with VitalCV.
 *
 * The persistent object continues: the SAME ProfileCard the hero built sits
 * at the center of discovery, rides the apply action, and heads the
 * employer's frame. Product visuals carry the explanation; each chapter has
 * one headline and at most one supporting sentence.
 *
 * DISCOVER — one dominant opportunity and two secondary possibilities around
 * the profile, never a job-board grid. Selecting an opportunity re-anchors
 * the "why it fits" rows, which are derived from the profile's own facts —
 * MATCHA understanding specialty, schedule, readiness. Matches are
 * illustrative and labelled; nothing is a live listing.
 *
 * APPLY — the handoff in depth. The clinician reviews what will be shared
 * (the canonical DECIDING face: rows travel or are held), and the employer
 * receives the permissioned packet (the canonical RETURNED face: what is
 * available, what still needs review, and where each item came from — the
 * stamps and provenance lines are exactly that). Both faces arrive
 * pre-rendered from the shared module; this component never builds record
 * markup of its own.
 *
 * Reveal-on-scroll is a single IntersectionObserver toggling data-seen;
 * under prefers-reduced-motion the CSS transitions are disabled and every
 * chapter is fully readable with no motion at all.
 */

import { useEffect, useRef, useState } from 'react';

import { ProfileCard, PROFILE } from '@/components/evidence-record/ProfileCard';

interface Opportunity {
  id: string;
  role: string;
  org: string;
  meta: string;
  fits: string[];
}

/* Fictional organizations only (Z0 data rule). The fit rows restate profile
 * facts — they introduce no claim the profile does not already carry. */
const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'cascade',
    role: 'Emergency Medicine PA',
    org: 'Cascade Regional Medical Center',
    meta: 'Full-time · Level II trauma',
    fits: ['Specialty — emergency medicine', 'Schedule — full-time preference', `Readiness — ${PROFILE.lanesFilled} of ${PROFILE.lanesTotal} evidence lanes answered`],
  },
  {
    id: 'harborview',
    role: 'Urgent Care PA',
    org: 'Blue Harbor Health',
    meta: 'Full-time · four-day week',
    fits: ['Adjacent specialty — urgent care', 'Schedule — full-time preference', `Readiness — ${PROFILE.lanesFilled} of ${PROFILE.lanesTotal} evidence lanes answered`],
  },
  {
    id: 'summit',
    role: 'EM PA · Locum',
    org: 'Summit Peak Clinics',
    meta: 'Locum · seasonal',
    fits: ['Specialty — emergency medicine', 'Flexible term — locum', `Readiness — ${PROFILE.lanesFilled} of ${PROFILE.lanesTotal} evidence lanes answered`],
  },
];

interface Props {
  /** Canonical DECIDING face — the clinician's review of what travels. */
  decidingFace: string;
  /** Canonical RETURNED face — what the employer can actually see. */
  returnedFace: string;
}

export function StoryChapters({ decidingFace, returnedFace }: Props) {
  const [picked, setPicked] = useState(OPPORTUNITIES[0]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-seen', ''); }),
      { rootMargin: '0px 0px -12% 0px' },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef}>
      {/* ================= chapter 2 · DISCOVER (MATCHA) ================= */}
      <section className="z1-chapter z1-discover" aria-label="Discover the right opportunity">
        <header className="z1-ch-head" data-reveal>
          <p className="z1-eyebrow">MATCHA · Discover</p>
          <h2 className="z1-ch-headline">Find work that fits more than your résumé.</h2>
          <p className="z1-ch-support">
            MATCHA reads the profile you already built — specialty, schedule,
            readiness — and puts the right opportunities around it.
          </p>
        </header>

        <div className="z1-discover-stage" data-reveal>
          {/* the persistent object, at the centre of discovery */}
          <div className="z1-discover-profile">
            <ProfileCard lit badge="Your profile" />
          </div>

          {/* one dominant opportunity, anchored to WHY */}
          <article className="z1-node z1-opp z1-opp--dominant" data-on aria-label={`Matched opportunity: ${picked.role}`}>
            <div className="z1-opp-main">
              <p className="z1-opp-role">{picked.role}</p>
              <p className="z1-opp-org">{picked.org} · {picked.meta}</p>
              <ul className="z1-fit-list">
                {picked.fits.map((f) => (
                  <li key={f} className="z1-fit"><span className="z1-fit-tie" aria-hidden="true" />{f}</li>
                ))}
              </ul>
            </div>
            <span className="z1-apply">Apply with VitalCV →</span>
          </article>

          {/* a small number of secondary possibilities — never a grid */}
          <div className="z1-discover-secondary" role="tablist" aria-label="Other illustrative matches">
            {OPPORTUNITIES.filter((o) => o.id !== picked.id).map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={false}
                className="z1-node z1-opp z1-opp--secondary"
                onClick={() => setPicked(o)}
              >
                <span className="z1-opp-role">{o.role}</span>
                <span className="z1-opp-org">{o.org} · {o.meta}</span>
              </button>
            ))}
          </div>

          <p className="z1-ch-note">Illustrative matches — not live listings</p>
        </div>
      </section>

      {/* ================= chapter 3 · APPLY WITH VITALCV ================= */}
      <section className="z1-chapter z1-apply-ch" aria-label="Apply without starting over">
        <header className="z1-ch-head" data-reveal>
          <p className="z1-eyebrow">Apply with VitalCV</p>
          <h2 className="z1-ch-headline">Apply once—with the information already assembled.</h2>
          <p className="z1-ch-support">
            You choose what travels; the employer sees what&rsquo;s available, what
            still needs review, and where each item came from.
          </p>
        </header>

        <div className="z1-handoff" data-reveal>
          {/* clinician side: the chosen opportunity, the action, the review */}
          <div className="z1-handoff-side z1-handoff-clinician">
            <p className="z1-side-tag">You</p>
            <div className="z1-node z1-opp z1-opp--chosen" data-on>
              <div className="z1-opp-main">
                <p className="z1-opp-role">{picked.role}</p>
                <p className="z1-opp-org">{picked.org}</p>
                <span className="z1-opp-attach">
                  <span className="z1-avatar z1-avatar--mini" aria-hidden="true">{PROFILE.monogram}</span>
                  {PROFILE.name} · profile attached
                </span>
              </div>
              <span className="z1-apply">Apply with VitalCV →</span>
            </div>
            <p className="z1-handoff-caption">Review what will be shared</p>
            <div className="z1-handoff-record" dangerouslySetInnerHTML={{ __html: decidingFace }} />
          </div>

          <div className="z1-handoff-arrow" aria-hidden="true"><span>the employer receives</span></div>

          {/* employer side: the permissioned packet — the record IS the answer
              to "available / needs review / where it came from" */}
          <div className="z1-handoff-side z1-handoff-employer">
            <p className="z1-side-tag">The employer</p>
            <div className="z1-packet-frame z1-packet-frame--deep">
              <p className="z1-packet-head">
                <span className="z1-avatar z1-avatar--mini" aria-hidden="true">{PROFILE.monogram}</span>
                Employer view · {PROFILE.name} · permissioned
              </p>
              <div className="z1-handoff-record" dangerouslySetInnerHTML={{ __html: returnedFace }} />
            </div>
            <p className="z1-handoff-caption z1-handoff-caption--outcome">
              <strong>Hired — and starting without rebuilding the record.</strong>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

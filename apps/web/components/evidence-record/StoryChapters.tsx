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
import { ROWS } from '@/components/evidence-record/faces.mjs';

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

const START_STEPS = [
  { id: 'received', label: 'Received' },
  { id: 'review', label: 'Review focused' },
  { id: 'headstart', label: 'Accepted as a head start' },
  { id: 'confirmed', label: 'Start confirmed' },
] as const;

export function StoryChapters({ decidingFace, returnedFace }: Props) {
  const [picked, setPicked] = useState(OPPORTUNITIES[0]);
  const [step, setStep] = useState(0);
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
          {/* clinician side: the chosen opportunity INITIATES the transfer —
              the directional connector leaves this card's row, not the column
              midpoint — then the review of what travels. */}
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
            <p className="z1-handoff-caption">Review what will be shared — rows travel or stay held</p>
            <div className="z1-handoff-record" dangerouslySetInnerHTML={{ __html: decidingFace }} />
          </div>

          <div className="z1-handoff-arrow" aria-hidden="true"><span>the employer receives</span></div>

          {/* employer side: outcome first, then the permissioned packet. The
              record is deliberately deeper than the clinician's review — the
              employer receives MORE context — and it is capped with an
              explicit continuation edge rather than scrolling the page. */}
          <div className="z1-handoff-side z1-handoff-employer">
            <p className="z1-side-tag">The employer</p>
            <div className="z1-packet-frame z1-packet-frame--deep">
              <p className="z1-packet-head">
                <span className="z1-avatar z1-avatar--mini" aria-hidden="true">{PROFILE.monogram}</span>
                Employer view · {PROFILE.name} · permissioned
              </p>
              <div className="z1-handoff-record z1-handoff-record--capped" dangerouslySetInnerHTML={{ __html: returnedFace }} />
              <p className="z1-record-continues">the record continues — six sources, every claim with its origin</p>
            </div>
            <p className="z1-handoff-caption z1-handoff-caption--outcome">
              <strong>Hired — and starting without rebuilding the record.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ================= chapter 4 · START SOONER ================= */}
      <section className="z1-chapter z1-start-ch" aria-label="Move from hired to ready sooner">
        <header className="z1-ch-head" data-reveal>
          <p className="z1-eyebrow">After the offer</p>
          <h2 className="z1-ch-headline">Move from hired to ready sooner.</h2>
          <p className="z1-ch-support">
            The record organizes what&rsquo;s ready and focuses what&rsquo;s left — review
            starts ahead, not from zero.
          </p>
        </header>

        {/* four interface states, one object — never four feature cards */}
        <div className="z1-start-stage" data-reveal>
          <div className="z1-steps" role="tablist" aria-label="From hired to ready">
            {START_STEPS.map((st, i) => (
              <button
                key={st.id}
                type="button"
                role="tab"
                aria-selected={i === step}
                className="z1-step"
                data-on={i <= step ? '' : undefined}
                data-active={i === step ? '' : undefined}
                onClick={() => setStep(i)}
              >
                <span className="z1-step-n">{String(i + 1).padStart(2, '0')}</span>
                {st.label}
              </button>
            ))}
          </div>

          <div className="z1-node z1-start-pane" data-on>
            {step === 0 && (
              <div className="z1-start-received">
                <span className="z1-avatar" aria-hidden="true">{PROFILE.monogram}</span>
                <div>
                  <p className="z1-start-line"><strong>{PROFILE.name}</strong> · permissioned record received</p>
                  <p className="z1-start-sub">{PROFILE.lanesFilled} of {PROFILE.lanesTotal} evidence lanes answered · every claim with its retrieval and origin</p>
                </div>
              </div>
            )}
            {step === 1 && (
              <ul className="z1-review-list">
                {ROWS.filter((r) => r.s === 's-acc' || r.s === 's-pend').map((r) => (
                  <li key={r.c} className="z1-review-row">
                    <span className="z1-review-claim">{r.c}</span>
                    <span className="z1-review-state">{r.r}</span>
                  </li>
                ))}
                <li className="z1-review-row z1-review-row--note">Remaining review is already identified — nothing is rediscovered from zero.</li>
              </ul>
            )}
            {step === 2 && (
              <div className="z1-start-received">
                <span className="z1-headstart-mark" aria-hidden="true">→</span>
                <div>
                  <p className="z1-start-line"><strong>Accepted as a head start.</strong></p>
                  <p className="z1-start-sub">Available evidence is organized for the employer&rsquo;s own review — a head start, not completed credentialing and not an automatic decision.</p>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="z1-start-received">
                <span className="z1-day-chip" aria-hidden="true">Day one</span>
                <div>
                  <p className="z1-start-line"><strong>Start confirmed.</strong></p>
                  <p className="z1-start-sub">{PROFILE.name} moves toward a confirmed start — the remaining review ran alongside, not in front.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= chapter 5 · KEEP YOUR RECORD ================= */}
      <section className="z1-chapter z1-keep-ch" aria-label="Keep your record">
        <header className="z1-ch-head" data-reveal>
          <p className="z1-eyebrow">After the start</p>
          <h2 className="z1-ch-headline">Your career record keeps moving with you.</h2>
          <p className="z1-ch-support">
            The employer interaction ends; the profile stays yours — with the
            outcome carried as continuity, ready for the next opportunity.
          </p>
        </header>

        <div className="z1-keep-stage" data-reveal>
          {/* the persistent object returns to the clinician */}
          <div className="z1-keep-profile">
            <ProfileCard lit badge="Still yours" />
            <ul className="z1-continuity">
              <li className="z1-continuity-row">
                <span className="z1-continuity-mark" aria-hidden="true" />
                {picked.org} · application completed · kept on your record
              </li>
              <li className="z1-continuity-row">
                <span className="z1-continuity-mark" aria-hidden="true" />
                Evidence lanes stay answered — nothing is rebuilt next time
              </li>
            </ul>
          </div>

          {/* the loop closes: the kept record is what discovers the next
              opportunity — a ghost of the NEXT match, not a feature strip */}
          <div className="z1-loop-close" aria-hidden="true">
            <span className="z1-loop-close-word">the loop begins again</span>
            <div className="z1-node z1-opp z1-opp--secondary z1-opp--next">
              <span className="z1-opp-role">Your next opportunity</span>
              <span className="z1-opp-org">MATCHA keeps reading the record you keep</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

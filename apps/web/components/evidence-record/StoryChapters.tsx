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

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ProfileCard, PROFILE } from '@/components/evidence-record/ProfileCard';
import { ROWS } from '@/components/evidence-record/faces.mjs';

/* Decorative stage glyphs — pure inline SVG on the StoryIcon pattern
 * (components/home/StoryIcon.tsx): currentColor line work, sized and
 * stroke-weighted by the surface's CSS, always aria-hidden. The lucide set is
 * closed behind LINT-02, and these are story furniture, not state
 * iconography — TrustGlyph remains the only state iconography. */
function glyph(paths: ReactNode) {
  return function StageGlyph() {
    return (
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

/** An inbox tray — the packet received. */
const InboxGlyph = glyph(
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>
);

/** A magnifier over a check — review focused on what is already answered. */
const SearchCheckGlyph = glyph(
  <>
    <path d="m8 11 2 2 4-4" />
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
);

/** A clipboard with a check — accepted as a head start. */
const ClipboardCheckGlyph = glyph(
  <>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>
);

/** A calendar with a check — the start date confirmed. */
const CalendarCheckGlyph = glyph(
  <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </>
);

/** An employer building — the organisation behind the opportunity. */
const BuildingGlyph = glyph(
  <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </>
);

/**
 * Continuity rail — the VitalCV-owned chapter divider. The aperture-band
 * motif stretched between chapters: six lanes fill ONCE as it enters view,
 * information moving through a record. Deliberately not a heartbeat monitor.
 */
function PulseDivider() {
  return (
    <div className="z1-flowline" data-reveal aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => <span key={i} className="z1-flowline-lane" />)}
    </div>
  );
}

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
  { id: 'received', label: 'Received', Icon: InboxGlyph },
  { id: 'review', label: 'Review focused', Icon: SearchCheckGlyph },
  { id: 'headstart', label: 'Accepted as a head start', Icon: ClipboardCheckGlyph },
  { id: 'confirmed', label: 'Start confirmed', Icon: CalendarCheckGlyph },
] as const;

export function StoryChapters({ decidingFace, returnedFace }: Props) {
  const [picked, setPicked] = useState(OPPORTUNITIES[0]);
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [tieActive, setTieActive] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const discoverRef = useRef<HTMLElement | null>(null);

  /* The MATCHA tie animates only when the connection ACTIVATES — a new
   * selection — then settles into a static line. */
  const pick = (o: Opportunity) => {
    setPicked(o);
    setTieActive(true);
    setTimeout(() => setTieActive(false), 3400);
  };
  useEffect(() => { const t = setTimeout(() => setTieActive(false), 3400); return () => clearTimeout(t); }, []);

  /* The stepper advances on its own — an animated explainer — until the
   * visitor touches it; then it is theirs. Reduced motion never auto-plays. */
  useEffect(() => {
    if (!autoPlay || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setStep((v) => (v + 1) % START_STEPS.length), 3600);
    return () => clearInterval(t);
  }, [autoPlay, paused]);

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
      <section ref={discoverRef} className="z1-chapter z1-discover" aria-label="Discover the right opportunity">
        <header className="z1-ch-head" data-reveal>
          <p className="z1-eyebrow">Matches · Discover</p>
          <h2 className="z1-ch-headline">Find work that fits more than your résumé.</h2>
          <p className="z1-ch-support">
            Matching reads the profile you already built — specialty, schedule,
            readiness — and puts the right opportunities around it.
          </p>
        </header>

        <div className="z1-discover-stage" data-reveal>
          {/* the persistent object, at the centre of discovery */}
          <div className="z1-discover-profile" data-tie-active={tieActive ? '' : undefined}>
            <ProfileCard lit badge="Your profile" />
          </div>

          {/* one dominant opportunity, anchored to WHY */}
          <article className="z1-node z1-opp z1-opp--dominant" data-on aria-label={`Matched opportunity: ${picked.role}`}>
            <div className="z1-opp-main z1-pane-slide" key={picked.id}>
              <p className="z1-opp-role">{picked.role}</p>
              <p className="z1-opp-org"><BuildingGlyph />{picked.org} · {picked.meta}</p>
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
                onClick={() => pick(o)}
              >
                <span className="z1-opp-role">{o.role}</span>
                <span className="z1-opp-org">{o.org} · {o.meta}</span>
              </button>
            ))}
          </div>

          <p className="z1-ch-note">Illustrative matches — not live listings</p>
        </div>
      </section>
      <PulseDivider />

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
            <div className="z1-packet-frame z1-packet-frame--deep" data-home-source-cadence>
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
            {/* The one non-negotiable boundary, retained through every
                homepage rewrite: whatever the page shows, the hiring
                institution still decides. */}
            <p className="z1-truth-boundary" data-home-truth-boundary>
              Every packet is a head start for institution review — the hiring
              institution makes the decision.
            </p>
          </div>
        </div>
      </section>
      <PulseDivider />

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
        <div
          className="z1-start-stage"
          data-reveal
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
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
                onClick={() => { setAutoPlay(false); setStep(i); }}
              >
                <span className="z1-step-n">{String(i + 1).padStart(2, '0')}</span>
                <st.Icon />
                {st.label}
              </button>
            ))}
          </div>

          <div className="z1-node z1-start-pane" data-on>
            <div className="z1-pane-slide" key={step} style={{ width: '100%' }}>
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
        </div>
      </section>
      <PulseDivider />

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
              <li className="z1-continuity-row">
                <span className="z1-continuity-mark" aria-hidden="true" />
                A living record — it moves when your career does
              </li>
            </ul>
          </div>

          {/* the loop closes: the kept record is what discovers the next
              opportunity — a ghost of the NEXT match, not a feature strip */}
          <div className="z1-loop-close">
            <span className="z1-loop-close-word" aria-hidden="true">the loop begins again</span>
            <button
              type="button"
              className="z1-node z1-opp z1-opp--secondary z1-opp--next"
              onClick={() => discoverRef.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              })}
            >
              <span className="z1-opp-role">Your next opportunity →</span>
              <span className="z1-opp-org">Matching keeps reading the record you keep</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

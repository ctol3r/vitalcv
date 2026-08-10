'use client';

import * as React from 'react';
import Link from 'next/link';

import { checkNpi } from '@/lib/vital/npi';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { detectCapabilities, resolveTier, type SceneTier } from '@/components/home/scene/capabilities';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { TruthBoundary } from '@/components/home/TruthBoundary';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { ProductAction } from '@/design-system/components/ProductAction';
import { ProvenanceChip } from '@/design-system/components/ProvenanceChip';
import { ExpandingEyebrow } from '@/design-system/components/ExpandingEyebrow';
import {
  CapsuleFoot,
  CapsuleHead,
  CapsuleModelRow,
  CapsuleRow,
  CapsuleRows,
  CapsuleShell,
} from '@/components/home/evidence/EvidenceCapsule';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';
import { sourceCadenceSentence } from '@/lib/trust/sourceCadence';

import { CHAPTERS, ChapterRail } from './ChapterRail';
import {
  AWAITING_ROWS,
  ILLUSTRATIVE_LABEL,
  ILLUSTRATIVE_MODEL,
  ILLUSTRATIVE_WORKFLOW,
  SIGNING,
  TRAVEL_LEDGER,
} from './illustrative';
import { useFilmProgress } from './useFilmProgress';

/**
 * The VitalCV homepage — the founder-approved recovery direction (#1060,
 * Concept C: "Cinematic Ask + Evidence OS").
 *
 * ONE DOCUMENT OBJECT carries the whole argument. The evidence record forms
 * under the ask while a visitor is typing, resolves when sources answer,
 * carries their travel decisions, arrives at an employer as a smaller subset,
 * and closes as a seal. Those are five faces of one artifact, rendered through
 * one set of shared parts and one stylesheet — so what a visitor watches being
 * explained is literally the component their own number produces.
 *
 * WHAT THIS REPLACES. A five-scene film whose scenes shared a single visual
 * grammar (a serif phrase left, a beige table right, four times over), whose
 * arrival artifact was a 480px card floating in a 1440px stage, and whose real
 * returned state — the surface the primary action produces — rendered with no
 * stylesheet at all in production. See
 * `docs/design/home-recovery/current-state-inventory.md`.
 *
 * FALLBACK CONTRACT. The DOM below is a linear, SSR-complete vertical document
 * in chapter order. The film is a TRANSFORM applied to it after hydration on
 * eligible desktop — never a different document. With no JS, a coarse pointer,
 * reduced motion, or a narrow viewport, what remains is an ordinary readable
 * page, and every chapter's argument survives intact.
 *
 * ONE SCROLL OWNER. `useFilmProgress` holds the only scroll listener and the
 * only rAF on this route, and it publishes continuous progress as a CSS
 * variable rather than as React state — so scrolling the film re-renders
 * nothing. The chapter rail navigates by anchor, never by handler.
 */

const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Evidence network', href: '/evidence-network' },
  { label: 'Trust', href: '/trust' },
] as const;

function useSceneTier(): SceneTier {
  // 'static' until capabilities are proven — SSR and the first client render
  // must agree, and nothing animates before it is known to be safe.
  const [tier, setTier] = React.useState<SceneTier>('static');

  React.useEffect(() => {
    const apply = () => setTier(resolveTier(detectCapabilities(window)));
    apply();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, []);

  return tier;
}

export function HorizontalCareerFilm() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const runwayRef = React.useRef<HTMLDivElement | null>(null);
  const arrivalRef = React.useRef<HTMLElement | null>(null);
  const npiInputRef = React.useRef<HTMLInputElement | null>(null);
  /** The SOURCE RESPONSES chapter's own scroll spacer — see `.film-stage-*`. */
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const tier = useSceneTier();

  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submittedNpi, setSubmittedNpi] = React.useState<string | null>(null);

  /**
   * Publish the height of the pinned site chrome as `--film-chrome`.
   *
   * The stage is sticky and the nav above it is `sticky top-0` too. Without
   * this the stage pinned at 0 and stood a full 100vh, so the nav sat on top of
   * every chapter's first 78px. Measuring the real element is what makes it
   * correct at every breakpoint, and correct again after the announcement bar
   * is dismissed.
   */
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const header = document.querySelector('header');
      // Only chrome that STAYS counts — a banner that scrolls away must not
      // permanently shorten the stage.
      const pinned =
        header && getComputedStyle(header).position === 'sticky'
          ? Math.round(header.getBoundingClientRect().height)
          : 0;
      root.style.setProperty('--film-chrome', `${pinned}px`);
    };

    measure();
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    const header = document.querySelector('header');
    if (header) observer.observe(header);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  // The film explains the product. Once someone submits an NPI, release the
  // sticky stage into the complete vertical composition so their real answer is
  // never clipped by a pane or stranded off-screen. Resetting re-enables it.
  const filmEnabled = tier !== 'static' && submittedNpi === null;
  const { index, eligible, ready } = useFilmProgress(
    runwayRef,
    rootRef,
    CHAPTERS.length,
    filmEnabled,
    stageRef,
  );

  /**
   * Adopt anything typed before hydration.
   *
   * The field is server-rendered and focusable immediately, so a fast visitor
   * can type a full NPI before React attaches its change handler. The digits
   * land in the DOM, `raw` stays empty, and the submit button sits disabled on
   * a field that visibly contains a valid number — the input is stranded.
   *
   * Reading the live value once on mount closes that window. It is not a test
   * accommodation: it is the only path by which a real person's first
   * keystrokes can otherwise be silently discarded.
   */
  React.useEffect(() => {
    const typed = npiInputRef.current?.value ?? '';
    if (typed) setRaw((current) => (current ? current : typed));
  }, []);

  // The funnel's denominator.
  React.useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  /**
   * PAGE-WIDE HORIZONTAL TRAVEL IS RETIRED.
   *
   * The whole document used to translate sideways as one strip, so scrolling
   * moved the entire website left. That was never the intent: horizontal
   * movement belongs to menus, media rails and evidence artifacts INSIDE a
   * chapter — not to the page.
   *
   * The page is now an ordinary vertical document with the five chapters
   * stacked, which is the composition that already shipped to touch, tablet
   * and reduced-motion users and is therefore the best-tested path in the file.
   * The driver below is deliberately kept: it still publishes `--film-progress`
   * and the active chapter, which is what a sticky stage needs in order to
   * drive horizontal movement within itself. Re-enabling page-wide travel is
   * not a matter of flipping this back — it was removed on purpose.
   */
  const isFilm = false;
  void ready;
  void eligible;
  void filmEnabled;

  /**
   * Chapters that have been reached stay revealed. A single-shot reveal (CD-11)
   * must never play backwards, so this only ever grows.
   */
  const [seen, setSeen] = React.useState(0);
  React.useEffect(() => {
    setSeen((prev) => (index > prev ? index : prev));
  }, [index]);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const npiCheck = checkNpi(raw);
  const isValid = npiCheck.validity === 'valid';

  /**
   * Reset returns the reader to the question.
   *
   * The film is driven by ordinary scroll position, so this moves the SCROLL —
   * never the track transform directly, which would desynchronise the driver
   * from the window and break rule 4 in useFilmProgress.
   */
  const previousNpi = React.useRef<string | null>(null);
  React.useEffect(() => {
    const had = previousNpi.current;
    previousNpi.current = submittedNpi;
    if (had && !submittedNpi) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      arrivalRef.current?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      });
      // Reset restores the question, so it must restore the keyboard position
      // too. The input remounts in the same render; defer one frame until its
      // ref is available rather than leaving focus on the reset control.
      const frame = window.requestAnimationFrame(() => npiInputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [submittedNpi]);

  const handleSubmit = React.useCallback(() => {
    if (!isValid || !npiCheck.npi) {
      setError(npiCheck.reason ?? 'Enter a full 10-digit NPI.');
      return;
    }
    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', npiCheck.npi);
      window.localStorage.setItem('onboarding_npi', npiCheck.npi);
    } catch {
      // The lookup still works when storage is unavailable.
    }
    setSubmittedNpi(npiCheck.npi);
  }, [isValid, npiCheck.npi, npiCheck.reason]);

  return (
    <div
      ref={rootRef}
      className="film"
      data-film-mode={isFilm ? 'film' : 'vertical'}
      data-film-tier={tier}
      style={{ ['--film-spans' as string]: String(CHAPTERS.length - 1) }}
    >
      {/* Runway height scales with the chapter count so travel stays one
          viewport per transition. Inline rather than in CSS precisely so it
          cannot drift out of sync when a chapter is added or removed. */}
      <div
        ref={runwayRef}
        className="film-runway"
        style={isFilm ? { height: `${CHAPTERS.length * 100}vh` } : undefined}
      >
        <div className="film-stage">
          <div className="film-track">
            {/* ---------------------------------------------- 01 YOUR NUMBER */}
            <section
              ref={arrivalRef}
              id="your-number"
              className="film-chapter"
              /* `data-home-hero` is the release marker `scripts/deploy-smoke.mjs`
                 greps out of the raw production response to prove `/` actually
                 rendered. It is deliberately composition-agnostic — it rode the
                 old vertical hero, it rode the previous film, and it rides this
                 chapter — because a deploy check that must be rewritten for
                 every redesign is one that silently stops working. It did once.
                 Do not remove without re-pointing deploy-smoke.mjs in the same
                 change. */
              data-home-hero=""
              data-film-scene="arrival"
              data-film-seen=""
              data-header-theme="light"
              data-header-stage="your-number"
              aria-label={CHAPTERS[0].label}
            >
              <div className="film-ask">
                <ExpandingEyebrow
                  detail="Your number, what the sources returned, what you release, and who decides."
                  className="film-ask-eyebrow"
                >
                  For clinicians
                </ExpandingEyebrow>

                <h1 className="film-h1">
                  Get hired on <em>evidence</em>.
                </h1>
                <p className="film-ask-support">Start with your NPI.</p>

                {/* The ask is a ruled line on the record itself. Hidden once a
                    lookup returns — leaving the field above the answer invites
                    re-entry of a number that has already been answered, and
                    the result owns the control that brings it back. */}
                {!submittedNpi ? (
                  <form
                    className="film-writing-line"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSubmit();
                    }}
                  >
                    <label htmlFor="film-npi-input" className="film-npi-label">
                      Your 10-digit NPI
                    </label>
                    <div className="film-line-row">
                      <input
                        ref={npiInputRef}
                        id="film-npi-input"
                        className="film-npi-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="10-digit NPI"
                        value={raw}
                        onChange={(event) => {
                          setRaw(event.target.value);
                          setError(null);
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby="film-npi-hint"
                      />
                      <ProductAction
                        type="submit"
                        arrow
                        disabled={!isValid}
                        className="film-npi-submit"
                        data-home-primary-cta=""
                      >
                        Check what&rsquo;s ready
                      </ProductAction>
                    </div>
                    <div className="film-ask-meta">
                      <p
                        id="film-npi-hint"
                        className="film-ask-hint"
                        data-invalid={error ? '' : undefined}
                        role={error ? 'alert' : undefined}
                      >
                        {error ??
                          (digits.length === 10
                            ? isValid
                              ? 'Press Enter to continue'
                              : (npiCheck.reason ?? 'Check the number for a typo.')
                            : `${digits.length}/10 digits`)}
                        <span aria-hidden="true"> · </span>
                        Free for clinicians · No account required
                      </p>
                      {/* The employer door. After the clinician's action in DOM
                          order, always — this page belongs to the clinician. */}
                      <Link
                        href="/employers"
                        className="film-employer-path"
                        data-home-employer-cta=""
                        onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
                      >
                        For employers — see what arrives
                      </Link>
                    </div>
                  </form>
                ) : null}

                {/* ---- The real returned state, in place ----
                     The answer to the question the reader just asked, in the
                     frame they asked it in. This renders only when a real
                     lookup has returned, and nothing personal is invented to
                     fill the frame beforehand. */}
                {submittedNpi ? (
                  <div className="film-writing-line">
                    <LiveNpiResult
                      npi={submittedNpi}
                      onReset={() => {
                        setSubmittedNpi(null);
                        setRaw('');
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {/* ---- The record gathering ----
                   The same six lanes the capsule will show, in their true state
                   for a visitor who has entered nothing. Every row is
                   registry-derived; none of it is a claim about anyone. */}
              {!submittedNpi ? (
                <div className="film-summon">
                  <p className="film-summon-eyebrow">Evidence record · awaiting your number</p>
                  <ul className="film-fan">
                    {AWAITING_ROWS.map((lane) => (
                      <li key={lane.id} className="film-strip">
                        <div className="film-strip-top">
                          <span className="film-strip-name">{lane.claim}</span>
                          <ProvenanceChip
                            state={lane.state}
                            label={lane.stateLabel}
                            // Pre-lookup lane: nothing queried, nothing to
                            // attribute to a source. `lane.meta` below paints
                            // the source · cadence line.
                            attribution={{ declared: 'no lookup yet' }}
                            provenanceLine="hidden"
                            shape="stamp"
                            size="sm"
                          />
                        </div>
                        <p className="film-strip-meta">{lane.meta}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* ----------------------------------------- 02 SOURCE RESPONSES

                THE STICKY STAGE.

                The page scrolls vertically. This one chapter pins for three
                viewports while the evidence record travels HORIZONTALLY through
                its own lifecycle beside a fixed argument column — the record
                gathering, resolving, and then showing what stands behind a
                single claim.

                This is the shape that replaced page-wide travel: the document
                never moves sideways, but a reader who scrolls through this
                chapter watches one object move across the frame. Ordinary
                vertical scroll is read, never captured — the spacer is a plain
                tall element and the browser keeps the scroll.

                On touch, narrow viewports and reduced motion the spacer
                collapses and the frames stack vertically (see home.css), so the
                argument survives without the pin. */}
            <section
              id="sources"
              className="film-chapter film-chapter--staged"
              data-film-scene="sources"
              data-film-seen={!isFilm || seen >= 1 ? '' : undefined}
              data-header-theme="light"
              data-header-stage="sources"
              aria-label={CHAPTERS[1].label}
            >
              <div ref={stageRef} className="film-stage-spacer">
                <div className="film-stage-pin">
                  <div className="film-stage-argument film-reveal">
                    <h2 className="film-phrase">This is what came back.</h2>
                    <p className="film-support">
                      Every claim arrives with the source that answered, that source&rsquo;s own
                      refresh cadence, and the limit of what it can settle — including the lane
                      VitalCV cannot read yet.
                    </p>
                    <p className="film-cadence" data-home-source-cadence="">
                      {sourceCadenceSentence()}
                    </p>
                  </div>

                  {/* The rail. Three frames of ONE record, not three cards:
                      same shell, same header, same rows — a document being
                      examined, which is the distinction CD-13 draws between a
                      media rail and a retired carousel. */}
                  <div className="film-stage-viewport">
                    <div className="film-stage-rail" data-film-stage-rail="">
                      <div className="film-stage-frame">
                        <CapsuleShell face="forming">
                          <CapsuleHead
                            eyebrow="Evidence record"
                            illustrative="Awaiting your number"
                          />
                          <CapsuleRows>
                            {AWAITING_ROWS.map((lane) => (
                              <CapsuleRow
                                key={lane.id}
                                claim={lane.claim}
                                returned={lane.meta}
                                trailing={
                                  <ProvenanceChip
                                    state={lane.state}
                                    label={lane.stateLabel}
                                    // AWAITING_ROWS are the pre-lookup lanes:
                                    // nothing has been queried, so there is no
                                    // source to name. `lane.meta` paints the
                                    // source · cadence line adjacently.
                                    attribution={{ declared: 'no lookup yet' }}
                                    provenanceLine="hidden"
                                    shape="stamp"
                                    size="sm"
                                  />
                                }
                              />
                            ))}
                          </CapsuleRows>
                        </CapsuleShell>
                      </div>

                      <div className="film-stage-frame">
                        <CapsuleShell face="resolved">
                          <CapsuleHead
                            eyebrow="Evidence record"
                            illustrative={ILLUSTRATIVE_LABEL}
                            name={ILLUSTRATIVE_MODEL.identity.name}
                            npi={`NPI ${ILLUSTRATIVE_MODEL.npi}`}
                          />
                          <CapsuleRows>
                            {ILLUSTRATIVE_MODEL.rows.map((row) => (
                              <CapsuleModelRow key={row.id} row={row} />
                            ))}
                          </CapsuleRows>
                          <CapsuleFoot>
                            <p className="evidence-capsule__foot-data">
                              {SIGNING.algorithm} · {SIGNING.keyId} · {SIGNING.keyPath}
                            </p>
                          </CapsuleFoot>
                        </CapsuleShell>
                      </div>

                      <div className="film-stage-frame">
                        {/* The third frame continues the SAME record's
                            lifecycle rather than repeating the packet
                            inspector, which lives in HUMAN REVIEW. Two copies
                            of one artifact on a page is the duplicate-intent
                            problem this whole recovery existed to remove — and
                            Playwright caught it as a strict-mode violation
                            before it shipped. */}
                        <CapsuleShell face="deciding">
                          <CapsuleHead
                            eyebrow="Evidence record"
                            illustrative={ILLUSTRATIVE_WORKFLOW}
                            name={ILLUSTRATIVE_MODEL.identity.name}
                            npi={`NPI ${ILLUSTRATIVE_MODEL.npi}`}
                          />
                          <CapsuleRows>
                            {TRAVEL_LEDGER.map((entry) => (
                              <CapsuleRow
                                key={entry.id}
                                claim={entry.claim}
                                returned={entry.detail}
                                trailing={
                                  <span
                                    className="evidence-capsule__mark"
                                    data-travel={entry.travels ? 'travels' : 'held'}
                                  >
                                    {entry.travels ? '→ Travels' : '■ Held'}
                                  </span>
                                }
                              />
                            ))}
                          </CapsuleRows>
                        </CapsuleShell>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------ 03 YOUR PERMISSION */}
            <section
              id="permission"
              className="film-chapter"
              data-film-scene="permission"
              data-film-seen={!isFilm || seen >= 2 ? '' : undefined}
              data-header-theme="light"
              data-header-stage="permission"
              aria-label={CHAPTERS[2].label}
            >
              <div className="film-two-col">
                <div className="film-reveal">
                  <h2 className="film-phrase">You decide what travels.</h2>
                  <p className="film-support">
                    Every row in the record is a decision. What you release moves with the
                    application. What you hold never leaves this page.
                  </p>
                  {/*
                    No route is named here. The path this panel used to print
                    does not exist, and printing one that 404s would be a promise
                    the product cannot keep — the illustrative frame makes the
                    workflow legible, it does not license an invented URL.

                    The path itself is deliberately not written out even in this
                    comment: `holder-route-contract` scans this file's raw source
                    for internal hrefs, so a dead path quoted in prose fails the
                    same guard as a live one. That is the guard working, not a
                    false positive — a URL in a source file is a URL.
                  */}
                  <p className="film-consent">
                    Permission recorded
                    <br />
                    Scope: this application
                    <br />
                    Revocable from your record
                  </p>
                </div>

                <div className="film-reveal">
                  <CapsuleShell face="deciding">
                    <CapsuleHead
                      eyebrow="Evidence record"
                      illustrative={ILLUSTRATIVE_WORKFLOW}
                      name={ILLUSTRATIVE_MODEL.identity.name}
                      npi={`NPI ${ILLUSTRATIVE_MODEL.npi}`}
                    />
                    <CapsuleRows>
                      {TRAVEL_LEDGER.map((entry) => (
                        <CapsuleRow
                          key={entry.id}
                          claim={entry.claim}
                          returned={entry.detail}
                          trailing={
                            <span
                              className="evidence-capsule__mark"
                              data-travel={entry.travels ? 'travels' : 'held'}
                            >
                              {entry.travels ? '→ Travels' : '■ Held'}
                            </span>
                          }
                        />
                      ))}
                    </CapsuleRows>
                    <CapsuleFoot>
                      <p className="evidence-capsule__foot-data">
                        {TRAVEL_LEDGER.filter((e) => e.travels).length} rows travel ·{' '}
                        {TRAVEL_LEDGER.filter((e) => !e.travels).length} rows held with you
                      </p>
                    </CapsuleFoot>
                  </CapsuleShell>

                  <div className="film-handoff" aria-hidden="true">
                    <span className="film-handoff-line" />
                    <span className="film-handoff-label">Only what travels</span>
                  </div>

                  <div className="film-employer-frame">
                    <CapsuleShell face="traveling">
                      <CapsuleHead eyebrow="Employer view" illustrative={ILLUSTRATIVE_WORKFLOW} />
                      <CapsuleRows>
                        {TRAVEL_LEDGER.filter((entry) => entry.travels).map((entry) => (
                          <CapsuleRow
                            key={entry.id}
                            claim={entry.claim}
                            trailing={<span className="film-arrives">arrives</span>}
                          />
                        ))}
                      </CapsuleRows>
                      <CapsuleFoot>
                        <p className="evidence-capsule__foot-data">
                          held rows are not in this frame — and their absence is not flagged
                        </p>
                      </CapsuleFoot>
                    </CapsuleShell>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------- 04 HUMAN REVIEW */}
            <section
              id="review"
              className="film-chapter"
              data-film-scene="review"
              data-film-seen={!isFilm || seen >= 3 ? '' : undefined}
              data-header-theme="light"
              data-header-stage="review"
              aria-label={CHAPTERS[3].label}
            >
              <div className="film-two-col">
                <div className="film-reveal">
                  <h2 className="film-phrase">They start from evidence, not from scratch.</h2>
                  <p className="film-boundary">
                    VitalCV assembles what these sources return. It does not credential,
                    privilege, or clear anyone — the institution keeps that decision.
                  </p>
                  <div className="film-checkpoint">
                    <p className="film-checkpoint-title">
                      <span aria-hidden="true">‖</span> Awaiting institution review
                    </p>
                    <p className="film-checkpoint-body">
                      Final credentialing, privileging, and hiring authority remain with the
                      institution.
                    </p>
                  </div>
                </div>

                {/* The packet an employer actually opens, claim by claim. This
                    is `ProofPacketInspector` rather than a picture of one: the
                    same component, the same illustrative labelling, and the
                    same SOURCE / RETRIEVAL / RECEIPT / LIMITATION ledger a
                    reviewer reads inside the product. */}
                <div className="film-reveal">
                  <ProofPacketInspector />
                </div>
              </div>
            </section>

            {/* -------------------------------------------------- 05 CLOSING */}
            <section
              id="closing"
              className="film-chapter"
              data-film-scene="closing"
              data-film-seen={!isFilm || seen >= 4 ? '' : undefined}
              /* The epilogue stays on `review`: the journey rail is four
                 stages by founder decision, and an undeclared final section
                 would drop the band's winner entirely — snapping the header
                 back to the route default mid-page. The reader is still in
                 the review-and-reuse part of the story here. */
              data-header-theme="light"
              data-header-stage="review"
              aria-label={CHAPTERS[4].label}
            >
              <div className="film-closing film-reveal">
                <p className="film-closing-line">The evidence can move.</p>

                <div className="film-seal">
                  <CapsuleShell face="sealed">
                    <CapsuleHead
                      eyebrow="Evidence record"
                      illustrative={ILLUSTRATIVE_LABEL}
                      npi={`NPI ${ILLUSTRATIVE_MODEL.npi}`}
                    />
                    <CapsuleFoot>
                      <p className="evidence-capsule__foot-data">
                        rcpt:nppes:8f2a…c41 · {SIGNING.algorithm} signed
                      </p>
                    </CapsuleFoot>
                  </CapsuleShell>
                </div>

                <p className="film-closing-line">
                  The decision stays <em>human</em>.
                </p>

                <div className="film-routes">
                  <ProductAction href="/onboarding" arrow>
                    Check my readiness
                  </ProductAction>
                  <ProductAction href="/employers" variant="secondary" arrow>
                    For employers
                  </ProductAction>
                </div>

                <TruthBoundary className="film-truth-boundary" />

                <nav aria-label="Trust footer" className="film-trust">
                  {TRUST_FOOTER_LINKS.map((link) => (
                    <Link key={link.href} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* The chapter menu sits OUTSIDE the track so it does not travel with it.
          In the vertical composition it is an ordinary in-page nav. */}
      <ChapterRail activeIndex={isFilm ? index : null} />
    </div>
  );
}

export default HorizontalCareerFilm;

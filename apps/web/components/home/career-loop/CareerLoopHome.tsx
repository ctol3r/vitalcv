'use client';

/**
 * THE ONE REAL LOOP — the production homepage (Wave 1075).
 *
 * This is `/`. The approved visual grammar (poster type, full-bleed rooms,
 * one persistent identity, almost no borders) carrying the REAL product:
 *
 *   NPI  →  clinician profile  →  MATCHA opportunity  →  Apply with VitalCV
 *        →  employer packet    →  employer review begins  →  keep the record
 *
 * Stage reality (docs/product/one-real-loop-contract.md):
 * - NPI resolution is the production stack (checkNpi + bootstrap + trust).
 * - Matches come from the real anonymous MATCHA feed; an empty feed is an
 *   honest state, never substituted.
 * - Apply is the REAL ApplyWithVitalCV component; anonymous users reach the
 *   authentication boundary and the surface says "Preview only — nothing has
 *   been sent."
 * - The employer packet preview mirrors the clinician's ACTUAL selection
 *   (onSelectionChange), and completion states appear only after the backend
 *   share actually succeeded.
 * - No "Start confirmed" exists anywhere: the truthful progression ends at
 *   "Employer review begins".
 *
 * The fictional journey is gone from the live path. It survives only behind
 * the explicit "Load an illustrative example" control, flagged on every
 * surface it touches.
 *
 * Class prefix is `clh-`, not the `rst-` of the /design/reset prototype this
 * grew from. Next bundles route CSS globally, so sharing 51 selector names
 * with a still-live design route would have let either page restyle the
 * other. The rollback variant (the evidence film) is a separate component
 * with its own stylesheet — see app/page.tsx.
 */

import { useEffect, useRef, useState } from 'react';

import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { useCareerLoop, type LoopMatch } from '@/lib/career-loop/useCareerLoop';
import { writeNpiHandoff } from '@/lib/onboarding/npiHandoff';
import { sourceCadenceSentence } from '@/lib/trust/sourceCadence';

/** Truthful rail: six stages, ending at review — never at a confirmed start. */
const STEPS = ['NPI', 'Profile', 'Opportunity', 'Apply', 'Packet', 'Review'] as const;

interface SelectedClaim { type: string; issuer?: string; status?: string }

export function CareerLoopHome() {
  const { state, onInput, submit, select, loadDemo, reset } = useCareerLoop();
  const [raw, setRaw] = useState('');
  const [selectedClaims, setSelectedClaims] = useState<SelectedClaim[]>([]);
  const [applyTouched, setApplyTouched] = useState(false);
  const [authBoundary, setAuthBoundary] = useState(false);
  const [shared, setShared] = useState<{ recipient?: string; bundleUrl?: string } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED); }, []);

  /*
   * Scroll-reveal. `[data-clh-reveal]` starts at opacity 0 and is revealed by
   * `data-seen`, so anything the observer misses never paints AT ALL.
   *
   * This ran once per `state.outcome`, which meant it only ever saw the nodes
   * that existed at resolution time. The opportunity block mounts later, when
   * the match feed returns — so it was observed by nothing and stayed
   * invisible for the whole session. Reduced motion forces opacity:1, which
   * is why it looked fine there and only there.
   *
   * One observer for the component's life; every render sweeps for nodes that
   * have appeared since. `observe()` on an already-observed element is a
   * no-op, so the sweep is safe to run unconditionally.
   */
  const revealRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!revealRef.current) {
      revealRef.current = new IntersectionObserver(
        (es) => es.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-seen', ''); }),
        { rootMargin: '0px 0px -10% 0px' },
      );
    }
    const io = revealRef.current;
    root.querySelectorAll('[data-clh-reveal]:not([data-seen])').forEach((el) => io.observe(el));
  });

  useEffect(() => () => { revealRef.current?.disconnect(); revealRef.current = null; }, []);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const { profile, isDemo } = state;
  const live = state.outcome === 'individual' && profile !== null;

  /* Rail progression from REAL state only. */
  const reached =
    shared ? 6
    : authBoundary || applyTouched ? (selectedClaims.length ? 5 : 4)
    : state.selected ? 3
    : live ? 2
    : digits.length > 0 || state.phase === 'resolving' ? 1
    : 0;
  const progress = `${Math.max(8, (reached / STEPS.length) * 100)}%`;

  const railPlate = (i: number): { text: string; on: boolean } => {
    const on = i < reached;
    switch (i) {
      case 0: return { on, text: digits.length ? `${digits.slice(0, 2)}${'•'.repeat(Math.max(0, digits.length - 2))}` : '··········' };
      case 1: return { on, text: live ? profile.displayName : 'Your profile' };
      case 2: return { on, text: state.selected ? state.selected.title : 'A match' };
      case 3: return { on, text: on ? 'Selected claims' : 'You choose' };
      case 4: return { on, text: on ? (shared ? 'Sent' : 'Prepared') : 'The packet' };
      case 5: return { on, text: on ? 'Review begins' : 'Their decision' };
      default: return { on, text: '' };
    }
  };

  const secondary = state.matches.filter((m) => m !== state.selected).slice(0, 2);

  return (
    <div className="clh" ref={rootRef}>
      {/* ================= OPENING — one unified scene ================= */}
      <section
        className="clh-room clh-open"
        data-home-hero
        id="your-number"
        data-header-theme="light"
        data-header-stage="your-number"
        aria-label="Start with your NPI"
      >
        <h1 className="clh-h">Get hired for the right opportunity—and start <em>sooner</em>.</h1>
        <p className="clh-sub">
          Build your clinician profile from your NPI, apply with it, and give employers a head start.
        </p>

        <form className="clh-bar" onSubmit={(e) => { e.preventDefault(); void submit(raw); }}>
          <label className="sr-only" htmlFor="clh-npi">Your 10-digit NPI</label>
          <input
            id="clh-npi"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Your 10-digit NPI"
            value={digits}
            onChange={(e) => { setRaw(e.target.value); onInput(e.target.value); setShared(null); setApplyTouched(false); setAuthBoundary(false); setSelectedClaims([]); }}
          />
          <button type="submit" data-home-primary-cta disabled={state.phase === 'resolving'}>
            {state.phase === 'resolving' ? 'Checking the registry…' : 'Start with your NPI'}
          </button>
        </form>
        {/* Honest, free, and countable: the NPI action states its own progress
            rather than implying a lookup has happened. Retained across three
            homepage rewrites (homepage-truth-pass). */}
        <p className="clh-count" aria-live="polite">{digits.length}/10 digits · free, no account needed</p>

        {/*
          SHD-2.2 — the quiet employer door, after the clinician action and
          visibly subordinate to it. VitalCV is one artifact for two audiences;
          a homepage that only addresses clinicians drops the side that decides
          whether any of this is worth anything.
        */}
        <a
          className="clh-employer"
          href="/employers"
          data-home-employer-cta=""
          onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
        >
          Hiring clinicians? See what employers review
        </a>

        {state.phase === 'invalid' && (
          <p className="clh-msg" role="status">{state.invalidReason} Re-enter it as it appears in the NPPES registry.</p>
        )}
        {state.phase === 'error' && (
          <p className="clh-msg" role="status">The lookup could not run. This is a system state, not a finding about this NPI — try again.</p>
        )}
        {state.outcome === 'organization' && (
          <p className="clh-msg" role="status">
            That NPI names an organization, not an individual clinician. A clinician profile starts from a personal Type 1 NPI.
          </p>
        )}
        {state.outcome === 'unavailable' && (
          <p className="clh-msg" role="status">
            The registry could not answer for this number right now — no identity was returned, and nothing was recorded.
          </p>
        )}

        {/* THE TRANSFORMATION — the rail, driven by real state */}
        <div className="clh-track" style={{ ['--clh-progress' as string]: progress }} aria-label="NPI to employer review">
          {STEPS.map((name, i) => {
            const plate = railPlate(i);
            /*
             * Nothing has happened yet means NO step is active. `Math.max(0,
             * reached - 1)` forced step 0 active at rest, so the empty NPI
             * plate rendered with the filled active treatment over the ghost
             * styling — a muddy grey block that read as a broken asset rather
             * than an empty state. The whole rail is ghosted until the visitor
             * actually starts.
             */
            const active = reached > 0 && i === reached - 1;
            return (
              <div className="clh-step" key={name} data-on={plate.on ? '' : undefined} data-active={active ? '' : undefined}>
                <div className={`clh-plate${plate.on ? '' : ' clh-plate--ghost'}`}>
                  {i === 0
                    ? <span className="clh-mono-lg">{plate.text}</span>
                    : <span className="clh-plate-name">{plate.text}</span>}
                </div>
                <span className="clh-step-name">{name}</span>
              </div>
            );
          })}
        </div>

        <p className="clh-fine" data-home-source-cadence="">
          {isDemo
            ? 'Illustrative example — fictional clinician and opportunities, clearly not a live result'
            : sourceCadenceSentence()}
          {' · '}
          <button type="button" className="clh-demo-link" onClick={loadDemo}>
            Load an illustrative example
          </button>
        </p>
      </section>

      {/* ================= 1 · CREATE — ink ================= */}
      <section
        className="clh-room clh-room--ink clh-create"
        id="sources"
        data-header-theme="dark"
        data-header-stage="sources"
        aria-label="Create"
      >
        <span className="clh-mark" aria-hidden="true">01</span>
        <div className="clh-create-id" data-clh-reveal>
          <span className={`clh-mono clh-mono--xl${live ? '' : ' clh-mono--ghost'}`} aria-hidden="true">
            {live ? profile.monogram : ''}
          </span>
          {live ? (
            <>
              <p className="clh-name-xl">
                {profile.displayName}{profile.credential ? `, ${profile.credential}` : ''}
              </p>
              <p className="clh-role">
                {[profile.specialty, profile.location].filter(Boolean).join(' · ') || 'Specialty not listed in the registry'}
              </p>
              <div className="clh-lanes" role="img"
                aria-label={`${profile.readinessSummary.answered} of ${profile.readinessSummary.total} sources answered`}>
                {Array.from({ length: profile.readinessSummary.total }, (_, i) => (
                  <span className="clh-lane" key={i} data-f={i < profile.readinessSummary.answered ? '' : undefined} />
                ))}
              </div>
              <p className="clh-lane-line">
                {profile.readinessSummary.answered} of {profile.readinessSummary.total} sources answered
                {profile.readinessSummary.needsReview > 0 ? ` · ${profile.readinessSummary.needsReview} still need review` : ''}
                {isDemo ? ' · illustrative' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="clh-name-xl clh-dim">Your name, from the registry</p>
              <p className="clh-role">Enter your NPI above</p>
            </>
          )}
        </div>
        <div data-clh-reveal>
          <h2 className="clh-h">A number becomes a career.</h2>
          {live && <p className="clh-sub">A profile you own and reuse — not another application form.</p>}
        </div>
      </section>

      {/* ================= 2 · DISCOVER — MATCHA ================= */}
      {/* DISCOVER continues the Sources act of the journey narrative: still
          "what the record shows", before the truth boundary at Apply. */}
      <section
        className="clh-room clh-room--deep clh-discover"
        data-header-theme="light"
        data-header-stage="sources"
        aria-label="Discover"
      >
        <span className="clh-mark" aria-hidden="true">02</span>
        <div data-clh-reveal>
          <h2 className="clh-h">Work that fits more than a résumé.</h2>
        </div>

        {state.matchPhase === 'loading' && (
          <p className="clh-sub" role="status">Reading the profile…</p>
        )}
        {state.matchPhase === 'error' && (
          <p className="clh-sub" role="status">Matching is unavailable right now. Your profile is unaffected — try again, or browse the open board.</p>
        )}
        {state.matchPhase === 'empty' && (
          <div data-clh-reveal>
            <p className="clh-sub">No current opportunities match this profile. The profile stays complete — nothing resets.</p>
            <div className="clh-actions">
              <a className="clh-act" href="/holder/matcha">Update preferences</a>
              <a className="clh-act clh-act--quiet" href="/explore">Browse open opportunities</a>
            </div>
          </div>
        )}
        {state.matchPhase === 'idle' && !live && (
          <p className="clh-sub clh-dim">Real opportunities appear when your profile resolves.</p>
        )}

        {state.selected && (
          <div className="clh-opp" data-clh-reveal>
            <div>
              <p className="clh-opp-role">{state.selected.title}</p>
              <p className="clh-opp-org">
                {[state.selected.organizationName, state.selected.location, state.selected.hiringType].filter(Boolean).join(' · ')}
              </p>
            </div>
            {state.selected.fitReasons.length > 0 && (
              <ul className="clh-why">
                {state.selected.fitReasons.map((r) => <li key={r.label}>{r.label}</li>)}
              </ul>
            )}
            {state.selected.blockers.length > 0 && (
              <p className="clh-blockers">
                Still open: {state.selected.blockers.map((b) => b.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        {secondary.length > 0 && (
          <div className="clh-secondary" data-clh-reveal>
            {secondary.map((m: LoopMatch) => (
              <button key={m.opportunityId || m.title} type="button" className="clh-alt" onClick={() => select(m)}>
                <span className="clh-alt-role">{m.title}</span>
                <span className="clh-alt-org">{[m.organizationName, m.location].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
        <p className="clh-fine">
          {isDemo ? 'Illustrative matches — not live listings' : 'Ranked from open listings · reasons are computed, not written'}
        </p>
      </section>

      {/* ================= 3 · APPLY — indigo ================= */}
      <section
        className="clh-room clh-room--indigo clh-apply"
        id="permission"
        data-header-theme="dark"
        data-header-stage="permission"
        aria-label="Apply"
      >
        <span className="clh-mark" aria-hidden="true">03</span>
        <div data-clh-reveal>
          <h2 className="clh-h">The same profile, handed over.</h2>
          {live && <p className="clh-sub">You choose what travels. The employer sees where each item came from.</p>}
        </div>

        <div className="clh-cross" data-clh-reveal>
          <div className="clh-side">
            <span className="clh-who">You</span>
            <div className="clh-carry">
              <span className={`clh-mono clh-mono--sm${live ? '' : ' clh-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
              <span>
                <span className="clh-carry-name">{live ? profile.displayName : 'Your profile'}</span>
                <span className="clh-carry-sub">with permission</span>
              </span>
            </div>
            {live && !isDemo && state.selected?.applyAvailable ? (
              <div className="clh-apply-embed" onClickCapture={() => setApplyTouched(true)}>
                <ApplyWithVitalCV
                  npi={profile.npi}
                  appearance="career-loop"
                  /* C3 — the recipient is resolved from the SELECTED
                     opportunity and re-verified server-side; changing the
                     selection remounts with fresh context (key), so stale
                     recipient state cannot survive. */
                  key={state.selected.opportunityId}
                  recipient={{
                    organizationId: state.selected.organizationId!,
                    organizationName: state.selected.organizationName ?? 'This organization',
                    opportunityId: state.selected.opportunityId,
                  }}
                  onSelectionChange={(sel) => setSelectedClaims(sel.map((c) => ({ type: c.type, issuer: c.issuer, status: c.status })))}
                  onAuthRequired={() => setAuthBoundary(true)}
                  onShareComplete={(r) => setShared({ recipient: r.recipient?.name, bundleUrl: r.bundleUrl })}
                />
              </div>
            ) : live && !isDemo && state.selected && !state.selected.applyAvailable ? (
              <p className="clh-carry-sub">
                Apply with VitalCV isn&rsquo;t available for this listing yet — it has no receiving
                organization on file. <a className="clh-demo-link" href="/explore">Browse other opportunities</a>
              </p>
            ) : (
              <p className="clh-carry-sub">
                {isDemo
                  ? 'Illustrative example — the live Apply flow needs a real NPI'
                  : 'Opens when your NPI resolves'}
              </p>
            )}
          </div>

          <span className="clh-arrow" aria-hidden="true">→</span>

          <div className="clh-side clh-side--to">
            <span className="clh-who">{state.selected?.organizationName ?? 'The employer'}</span>
            <div className="clh-carry">
              <span className={`clh-mono clh-mono--sm${live ? '' : ' clh-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
              <span>
                <span className="clh-carry-name">{shared ? 'Received' : 'The packet'}</span>
                <span className="clh-carry-sub">
                  {shared
                    ? `sent to ${shared.recipient ?? 'the organization'}`
                    : selectedClaims.length
                      ? `${selectedClaims.length} selected item${selectedClaims.length === 1 ? '' : 's'} would travel`
                      : 'exactly what you select — nothing more'}
                </span>
              </span>
            </div>
            {selectedClaims.length > 0 && !shared && (
              <ul className="clh-packet-list" aria-label="What would travel">
                {selectedClaims.slice(0, 6).map((c) => (
                  <li key={c.type}>{c.type}{c.issuer ? ` — ${c.issuer}` : ''}</li>
                ))}
                {selectedClaims.length > 6 && <li>+ {selectedClaims.length - 6} more</li>}
              </ul>
            )}
            <p className="clh-fine" data-home-truth-boundary="">
              {shared
                ? 'Delivered by the share service. Institution review decides the outcome.'
                : 'Preview only — nothing has been sent. Institution review decides the outcome.'}
            </p>
          </div>
        </div>
      </section>

      {/* ================= 4 · CONTINUE — ivory ================= */}
      <section
        className="clh-room clh-continue"
        id="review"
        data-header-theme="light"
        data-header-stage="review"
        aria-label="Continue"
      >
        <span className="clh-mark" aria-hidden="true">04</span>
        <div data-clh-reveal>
          <h2 className="clh-h">Review starts ahead, not from zero.</h2>
          <p className="clh-outcome">Start sooner.</p>
        </div>
        <div className="clh-keep" data-clh-reveal>
          <span className={`clh-mono clh-mono--xl${live ? '' : ' clh-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
          <div>
            <p className="clh-keep-line">Keep your profile. Update it once. Use it again.</p>
            {live && (
              <p className="clh-keep-sub">
                {`${profile.displayName}'s record stays ${isDemo ? 'theirs' : 'yours'} — a completed application never resets it.`}
              </p>
            )}
            <div className="clh-actions">
              {/* Record-first sequencing (founder audit 2026-08-06): this used
                  to point at /holder, whose layout redirects anonymous
                  visitors to sign-in — the page's own "no account" promise,
                  repossessed. It now hands the resolved NPI to /onboarding,
                  which shows the record before the account ask. Label matches
                  the film variant's EvidenceCapsule CTA, so both home
                  compositions carry one vocabulary. */}
              <a
                className="clh-act clh-act--ink"
                href="/onboarding"
                onClick={() => {
                  if (live && !isDemo && profile?.npi) writeNpiHandoff(profile.npi);
                }}
              >
                Keep this record
              </a>
              <button type="button" className="clh-act clh-act--quiet" onClick={() => { setRaw(''); reset(); setShared(null); setSelectedClaims([]); setApplyTouched(false); setAuthBoundary(false); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>
                Check another NPI
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

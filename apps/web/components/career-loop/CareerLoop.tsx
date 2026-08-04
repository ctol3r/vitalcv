'use client';

/**
 * THE ONE REAL LOOP — /design/reset (Wave 1072).
 *
 * The reset's visual grammar (poster type, full-bleed rooms, one identity,
 * almost no borders) carrying the REAL product:
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
 * The fictional K. Osei journey is gone from the live path. It survives only
 * behind the explicit "Load an illustrative example" control, flagged on
 * every surface it touches.
 */

import { useEffect, useRef, useState } from 'react';

import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { useCareerLoop, type LoopMatch } from '@/lib/career-loop/useCareerLoop';

/** Truthful rail: six stages, ending at review — never at a confirmed start. */
const STEPS = ['NPI', 'Profile', 'Opportunity', 'Apply', 'Packet', 'Review'] as const;

interface SelectedClaim { type: string; issuer?: string; status?: string }

export function CareerLoop() {
  const { state, onInput, submit, select, loadDemo, reset } = useCareerLoop();
  const [raw, setRaw] = useState('');
  const [selectedClaims, setSelectedClaims] = useState<SelectedClaim[]>([]);
  const [applyTouched, setApplyTouched] = useState(false);
  const [authBoundary, setAuthBoundary] = useState(false);
  const [shared, setShared] = useState<{ recipient?: string; bundleUrl?: string } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED); }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-seen', ''); }),
      { rootMargin: '0px 0px -10% 0px' },
    );
    root.querySelectorAll('[data-rst-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [state.outcome]);

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
    <div className="rst" ref={rootRef}>
      {/* ================= OPENING — one unified scene ================= */}
      <section className="rst-room rst-open" data-home-hero aria-label="Start with your NPI">
        <h1 className="rst-h">Get hired for the right opportunity—and start <em>sooner</em>.</h1>
        <p className="rst-sub">
          Build your clinician profile from your NPI, apply with it, and give employers a head start.
        </p>

        <form className="rst-bar" onSubmit={(e) => { e.preventDefault(); void submit(raw); }}>
          <label className="sr-only" htmlFor="rst-npi">Your 10-digit NPI</label>
          <input
            id="rst-npi"
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

        {state.phase === 'invalid' && (
          <p className="rst-msg" role="status">{state.invalidReason} Re-enter it as it appears in the NPPES registry.</p>
        )}
        {state.phase === 'error' && (
          <p className="rst-msg" role="status">The lookup could not run. This is a system state, not a finding about this NPI — try again.</p>
        )}
        {state.outcome === 'organization' && (
          <p className="rst-msg" role="status">
            That NPI names an organization, not an individual clinician. A clinician profile starts from a personal Type 1 NPI.
          </p>
        )}
        {state.outcome === 'unavailable' && (
          <p className="rst-msg" role="status">
            The registry could not answer for this number right now — no identity was returned, and nothing was recorded.
          </p>
        )}

        {/* THE TRANSFORMATION — the rail, driven by real state */}
        <div className="rst-track" style={{ ['--rst-progress' as string]: progress }} aria-label="NPI to employer review">
          {STEPS.map((name, i) => {
            const plate = railPlate(i);
            const active = i === Math.max(0, reached - 1);
            return (
              <div className="rst-step" key={name} data-on={plate.on ? '' : undefined} data-active={active ? '' : undefined}>
                <div className={`rst-plate${plate.on ? '' : ' rst-plate--ghost'}`}>
                  {i === 0
                    ? <span className="rst-mono-lg">{plate.text}</span>
                    : <span className="rst-plate-name">{plate.text}</span>}
                </div>
                <span className="rst-step-name">{name}</span>
              </div>
            );
          })}
        </div>

        <p className="rst-fine">
          {isDemo
            ? 'Illustrative example — fictional clinician and opportunities, clearly not a live result'
            : 'Reads the public NPPES registry'}
          {' · '}
          <button type="button" className="rst-demo-link" onClick={loadDemo}>
            Load an illustrative example
          </button>
        </p>
      </section>

      {/* ================= 1 · CREATE — ink ================= */}
      <section className="rst-room rst-room--ink rst-create" aria-label="Create">
        <span className="rst-mark" aria-hidden="true">01</span>
        <div className="rst-create-id" data-rst-reveal>
          <span className={`rst-mono rst-mono--xl${live ? '' : ' rst-mono--ghost'}`} aria-hidden="true">
            {live ? profile.monogram : ''}
          </span>
          {live ? (
            <>
              <p className="rst-name-xl">
                {profile.displayName}{profile.credential ? `, ${profile.credential}` : ''}
              </p>
              <p className="rst-role">
                {[profile.specialty, profile.location].filter(Boolean).join(' · ') || 'Specialty not listed in the registry'}
              </p>
              <div className="rst-lanes" role="img"
                aria-label={`${profile.readinessSummary.answered} of ${profile.readinessSummary.total} sources answered`}>
                {Array.from({ length: profile.readinessSummary.total }, (_, i) => (
                  <span className="rst-lane" key={i} data-f={i < profile.readinessSummary.answered ? '' : undefined} />
                ))}
              </div>
              <p className="rst-lane-line">
                {profile.readinessSummary.answered} of {profile.readinessSummary.total} sources answered
                {profile.readinessSummary.needsReview > 0 ? ` · ${profile.readinessSummary.needsReview} still need review` : ''}
                {isDemo ? ' · illustrative' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="rst-name-xl rst-dim">Your name, from the registry</p>
              <p className="rst-role">Nothing is invented — enter your NPI above</p>
            </>
          )}
        </div>
        <div data-rst-reveal>
          <h2 className="rst-h">A number becomes a career.</h2>
          {live && <p className="rst-sub">A profile you own and reuse — not another application form.</p>}
        </div>
      </section>

      {/* ================= 2 · DISCOVER — MATCHA ================= */}
      <section className="rst-room rst-room--deep rst-discover" aria-label="Discover">
        <span className="rst-mark" aria-hidden="true">02</span>
        <div data-rst-reveal>
          <h2 className="rst-h">Work that fits more than a résumé.</h2>
        </div>

        {state.matchPhase === 'loading' && (
          <p className="rst-sub" role="status">MATCHA is reading the profile…</p>
        )}
        {state.matchPhase === 'error' && (
          <p className="rst-sub" role="status">Matching is unavailable right now. Your profile is unaffected — try again, or browse the open board.</p>
        )}
        {state.matchPhase === 'empty' && (
          <div data-rst-reveal>
            <p className="rst-sub">No current opportunities match this profile. The profile stays complete — nothing resets.</p>
            <div className="rst-actions">
              <a className="rst-act" href="/holder/matcha">Update preferences</a>
              <a className="rst-act rst-act--quiet" href="/explore">Browse open opportunities</a>
            </div>
          </div>
        )}
        {state.matchPhase === 'idle' && !live && (
          <p className="rst-sub rst-dim">Real opportunities appear when your profile resolves.</p>
        )}

        {state.selected && (
          <div className="rst-opp" data-rst-reveal>
            <div>
              <p className="rst-opp-role">{state.selected.title}</p>
              <p className="rst-opp-org">
                {[state.selected.organizationName, state.selected.location, state.selected.hiringType].filter(Boolean).join(' · ')}
              </p>
            </div>
            {state.selected.fitReasons.length > 0 && (
              <ul className="rst-why">
                {state.selected.fitReasons.map((r) => <li key={r.label}>{r.label}</li>)}
              </ul>
            )}
            {state.selected.blockers.length > 0 && (
              <p className="rst-blockers">
                Still open: {state.selected.blockers.map((b) => b.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        {secondary.length > 0 && (
          <div className="rst-secondary" data-rst-reveal>
            {secondary.map((m: LoopMatch) => (
              <button key={m.opportunityId || m.title} type="button" className="rst-alt" onClick={() => select(m)}>
                <span className="rst-alt-role">{m.title}</span>
                <span className="rst-alt-org">{[m.organizationName, m.location].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
        <p className="rst-fine">
          {isDemo ? 'Illustrative matches — not live listings' : 'Ranked by MATCHA from open listings · reasons are computed, not written'}
        </p>
      </section>

      {/* ================= 3 · APPLY — indigo ================= */}
      <section className="rst-room rst-room--indigo rst-apply" aria-label="Apply">
        <span className="rst-mark" aria-hidden="true">03</span>
        <div data-rst-reveal>
          <h2 className="rst-h">The same profile, handed over.</h2>
          {live && <p className="rst-sub">You choose what travels. The employer sees where each item came from.</p>}
        </div>

        <div className="rst-cross" data-rst-reveal>
          <div className="rst-side">
            <span className="rst-who">You</span>
            <div className="rst-carry">
              <span className={`rst-mono rst-mono--sm${live ? '' : ' rst-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
              <span>
                <span className="rst-carry-name">{live ? profile.displayName : 'Your profile'}</span>
                <span className="rst-carry-sub">with permission</span>
              </span>
            </div>
            {live && !isDemo && state.selected?.applyAvailable ? (
              <div className="rst-apply-embed" onClickCapture={() => setApplyTouched(true)}>
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
              <p className="rst-carry-sub">
                Apply with VitalCV isn&rsquo;t available for this listing yet — it has no receiving
                organization on file. <a className="rst-demo-link" href="/explore">Browse other opportunities</a>
              </p>
            ) : (
              <p className="rst-carry-sub">
                {isDemo
                  ? 'Illustrative example — the live Apply flow needs a real NPI'
                  : 'Opens when your NPI resolves'}
              </p>
            )}
          </div>

          <span className="rst-arrow" aria-hidden="true">→</span>

          <div className="rst-side rst-side--to">
            <span className="rst-who">{state.selected?.organizationName ?? 'The employer'}</span>
            <div className="rst-carry">
              <span className={`rst-mono rst-mono--sm${live ? '' : ' rst-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
              <span>
                <span className="rst-carry-name">{shared ? 'Received' : 'The packet'}</span>
                <span className="rst-carry-sub">
                  {shared
                    ? `sent to ${shared.recipient ?? 'the organization'}`
                    : selectedClaims.length
                      ? `${selectedClaims.length} selected item${selectedClaims.length === 1 ? '' : 's'} would travel`
                      : 'exactly what you select — nothing more'}
                </span>
              </span>
            </div>
            {selectedClaims.length > 0 && !shared && (
              <ul className="rst-packet-list" aria-label="What would travel">
                {selectedClaims.slice(0, 6).map((c) => (
                  <li key={c.type}>{c.type}{c.issuer ? ` — ${c.issuer}` : ''}</li>
                ))}
                {selectedClaims.length > 6 && <li>+ {selectedClaims.length - 6} more</li>}
              </ul>
            )}
            <p className="rst-fine">
              {shared
                ? 'Delivered by the share service — the institution runs its own review and makes its own decision'
                : 'Preview only — nothing has been sent. The institution runs its own review.'}
            </p>
          </div>
        </div>
      </section>

      {/* ================= 4 · CONTINUE — ivory ================= */}
      <section className="rst-room rst-continue" aria-label="Continue">
        <span className="rst-mark" aria-hidden="true">04</span>
        <div data-rst-reveal>
          <h2 className="rst-h">Review starts ahead, not from zero.</h2>
          <p className="rst-outcome">Start sooner.</p>
        </div>
        <div className="rst-keep" data-rst-reveal>
          <span className={`rst-mono rst-mono--xl${live ? '' : ' rst-mono--ghost'}`} aria-hidden="true">{live ? profile.monogram : ''}</span>
          <div>
            <p className="rst-keep-line">
              {live
                ? `${profile.displayName}'s record stays ${isDemo ? 'theirs' : 'yours'} — a completed application never resets it.`
                : 'Your record stays yours — a completed application never resets it.'}
            </p>
            <div className="rst-actions">
              <a className="rst-act rst-act--ink" href="/holder">Manage your record</a>
              <button type="button" className="rst-act rst-act--quiet" onClick={() => { setRaw(''); reset(); setShared(null); setSelectedClaims([]); setApplyTouched(false); setAuthBoundary(false); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>
                Check another NPI
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

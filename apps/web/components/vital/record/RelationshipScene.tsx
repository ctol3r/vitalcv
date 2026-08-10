'use client';

import * as React from 'react';

import { ConsentGate } from './ConsentGate';
import { IllustrationLabel, LivingRecord } from './LivingRecord';
import { ReviewDesk } from './ReviewDesk';
import { SourceKiosk } from './SourceKiosk';

/**
 * RelationshipScene — "One record, three actors" (ILL-04 composition, ILL-05
 * controls), synthesized from the founder's ILL prototype.
 *
 * ── What came from the prototype ───────────────────────────────────────────
 * The step controls, the replay affordance, the live transcript, the consent
 * gate as a visible place, the travelling packet, and the return path. Those
 * are the prototype's real contribution: they turn a diagram into something a
 * visitor can interrogate.
 *
 * ── What the synthesis changed, and why ────────────────────────────────────
 *
 *  1. NO SOURCE CHECKMARKS. The prototype gives every evidence tile a green
 *     `✓` and a green rule (`.ill-tile .src::before`). In an illustration no
 *     source has answered anything, so a confirmed mark there asserts exactly
 *     the certainty EC-3 forbids a treatment from implying — and EC-20 pins
 *     green to "only when a named source actually returns a match". The tile's
 *     attribution survives as glyph + word in ink.
 *  2. NO SEPARATE MOTION/STATIC/REDUCED TOGGLE AS THE SOURCE OF TRUTH. The
 *     prototype's three-way switch is useful for review, so it is kept — but
 *     the server always renders the COMPLETE composition, and motion only ever
 *     mounts on the client after the in-view, reduced-motion and save-data
 *     checks pass. Reduced motion is the composition, not a fallback (EC-26).
 *  3. TOKENS, NOT THE DIMENSION PALETTE. `--void/--bone/--brass/--clay` and the
 *     Google-hosted DM Sans are replaced by `--vt-scene-*` and the self-hosted
 *     Geist already locked in EC-20. Brass had no token behind it.
 *  4. NO SHADOWS OR GRADIENTS ON EVIDENCE. Z0 is absolute; depth comes from
 *     overlap and the record's top-edge weight.
 *
 * Motion obeys the EC-29 bands (150–250ms state, 250–450ms transformation),
 * plays once, and settles on the complete frame. Nothing loops.
 */

type Focus = 'holder' | 'issuer' | 'verifier' | null;

const TRANSCRIPT: Record<'all' | 'holder' | 'issuer' | 'verifier', string> = {
  all: 'The complete relationship. Sources add facts, one slot stays honestly open, you choose what leaves, and the employer reviews and decides.',
  holder:
    'You, the clinician. The record and its permission layer stay with you. Nothing leaves until you approve it.',
  issuer:
    'Trusted sources. Each contributes one fact it can answer for, with the date it answered and the edge of what it covers. What no source can answer stays open.',
  verifier:
    'Employer review. A separate desk receives only what you chose. A question can come back. The decision is theirs, and nothing has been decided.',
};

/** EC-29 band: product transformation. One pass, then still. */
const BEATS: Array<{ at: number; focus: Focus; key: keyof typeof TRANSCRIPT }> = [
  { at: 0, focus: 'holder', key: 'holder' },
  { at: 900, focus: 'issuer', key: 'issuer' },
  { at: 2600, focus: 'holder', key: 'holder' },
  { at: 4000, focus: 'verifier', key: 'verifier' },
  { at: 5600, focus: null, key: 'all' },
];

function motionPermitted(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  return conn?.saveData !== true;
}

export function RelationshipScene() {
  // The server frame is complete and focus-free. Every later state is a client
  // decision, so no visitor waits on JS to understand the scene.
  const [focus, setFocus] = React.useState<Focus>(null);
  const [caption, setCaption] = React.useState<keyof typeof TRANSCRIPT>('all');
  const [playing, setPlaying] = React.useState(false);
  const [canMove, setCanMove] = React.useState(false);
  /**
   * The controls are an enhancement, and until React has hydrated they cannot
   * do anything. Measured with JS disabled, all four rendered as ordinary live
   * buttons — a control that looks interactive and is inert is a broken
   * promise, and EC-4 makes the no-JS composition a first-class one that gets
   * reviewed rather than tolerated.
   *
   * They render DISABLED rather than hidden: a disabled button occupies the
   * same box, so enabling it on mount costs no layout shift, and `disabled` is
   * the real attribute rather than a styling lie (the D-02 precedent).
   */
  const [mounted, setMounted] = React.useState(false);
  const timers = React.useRef<number[]>([]);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const clearTimers = React.useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const play = React.useCallback(() => {
    clearTimers();
    setPlaying(true);
    BEATS.forEach((beat) => {
      timers.current.push(
        window.setTimeout(() => {
          setFocus(beat.focus);
          setCaption(beat.key);
          if (beat.key === 'all') setPlaying(false);
        }, beat.at),
      );
    });
  }, [clearTimers]);

  React.useEffect(() => {
    setMounted(true);
    setCanMove(motionPermitted());
  }, []);

  // Single play, only once in view, only when motion is permitted. A tab
  // hidden mid-sequence stops it rather than finishing unseen.
  React.useEffect(() => {
    if (!canMove || !rootRef.current) return;
    const el = rootRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const onHide = () => {
      if (document.hidden) {
        clearTimers();
        setPlaying(false);
        setFocus(null);
        setCaption('all');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      clearTimers();
    };
  }, [canMove, play, clearTimers]);

  const step = (next: Focus) => {
    clearTimers();
    setPlaying(false);
    const resolved = focus === next ? null : next;
    setFocus(resolved);
    setCaption(resolved ?? 'all');
  };

  const replay = () => {
    if (canMove) {
      play();
      return;
    }
    // Motion is not permitted, so "replay" restores the complete composition
    // rather than pretending to animate. The control still does something
    // honest instead of disappearing.
    clearTimers();
    setFocus(null);
    setCaption('all');
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers();
        setPlaying(false);
        setFocus(null);
        setCaption('all');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [clearTimers]);

  // Dimming is opacity only, and only ever a de-emphasis — every zone stays
  // present and readable, because the transcript is what carries the meaning.
  const zone = (name: Exclude<Focus, null>): React.CSSProperties => ({
    opacity: focus === null || focus === name ? 1 : 0.34,
    transition: 'opacity 220ms ease',
  });

  const STEPS: Array<{ id: Exclude<Focus, null>; label: string }> = [
    { id: 'holder', label: 'You, the clinician' },
    { id: 'issuer', label: 'Trusted sources' },
    { id: 'verifier', label: 'Employer review' },
  ];

  return (
    <div ref={rootRef} data-relationship-scene="" data-playing={playing ? 'true' : 'false'}>
      {/* ── controls ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Step through the relationship" className="flex flex-wrap gap-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!mounted}
              aria-pressed={focus === s.id}
              onClick={() => step(s.id)}
              className="min-h-[44px] px-3.5 text-[12px] font-medium"
              style={{
                background: 'transparent',
                color: focus === s.id ? 'var(--vt-scene-text)' : 'var(--vt-scene-text-secondary)',
                border: `1px solid ${focus === s.id ? 'var(--vt-scene-text)' : 'var(--vt-scene-line-strong)'}`,
                // EC-20 A-2: an action is square.
                borderRadius: 0,
                opacity: mounted ? 1 : 0.5,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!mounted}
          onClick={replay}
          className="min-h-[44px] px-3.5 text-[12px] font-medium"
          style={{
            background: 'transparent',
            color: 'var(--vt-scene-text)',
            border: '1px solid var(--vt-scene-line-strong)',
            borderRadius: 0,
            opacity: mounted ? 1 : 0.5,
          }}
        >
          {canMove ? 'Replay' : 'Reset'}
        </button>
      </div>

      {/* Says the true thing to the visitor who has no JS, rather than leaving
          four greyed controls unexplained. The story below is unaffected. */}
      <noscript>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--vt-scene-text-tertiary)]">
          The step controls need JavaScript. The scene below is already showing its complete state,
          and the full account is written out under it.
        </p>
      </noscript>

      {/* ── the transcript, which is where the meaning actually lives ───── */}
      <p
        data-scene-transcript=""
        aria-live="polite"
        className="mt-4 border-l-2 py-1 pl-3.5 text-[13px] leading-relaxed text-[var(--vt-scene-text-secondary)]"
        style={{ borderColor: 'var(--vt-accent-editorial-on-dark)', minHeight: 44 }}
      >
        {TRANSCRIPT[caption]}
      </p>

      {/* ── the composition ─────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-3" style={zone('issuer')}>
          <ZoneLabel>Trusted sources add facts</ZoneLabel>
          <SourceKiosk kind="training" />
          <SourceKiosk kind="licensing" />
          <SourceKiosk kind="certification" />
        </div>

        <div className="flex flex-col gap-4" style={zone('holder')}>
          <ZoneLabel>You, and the record you hold</ZoneLabel>
          {/* The holder is present as the record and the gate, not as a figure.
              A clinician silhouette was drawn here and removed at design
              review: it was a supporting glyph carrying no meaning the zone
              label did not already carry, it cost an EC-27 departure, and its
              round head was the only fully-round form in a kit whose geometry
              law is near-sharp stamps with pills retired. */}
          <div className="flex items-stretch gap-3">
            <LivingRecord face="returned" caption="Facts arrive. Open slots stay open." />
            <ConsentGate />
          </div>
          <LivingRecord
            face="deciding"
            caption="Your approval sits over the facts. Nothing has moved yet."
          />
        </div>

        <div className="flex flex-col gap-3" style={zone('verifier')}>
          <ZoneLabel>Employer review</ZoneLabel>
          <LivingRecord
            face="arrived"
            variant="recipient"
            caption="The same record with less of it. Held rows are absent, not greyed."
          />
          <ReviewDesk />
          <p className="text-[11px] leading-snug text-[var(--vt-scene-text-tertiary)]">
            A question comes back to you. Never an automatic outcome.
          </p>
        </div>
      </div>

      <IllustrationLabel className="mt-6" />
    </div>
  );
}

/**
 * The zones carry no numeral. They did, and on screen the three columns read
 * "02, 01, 03" left to right, which looks like a mistake to anyone who has not
 * read the code.
 *
 * The arrangement is spatial, not sequential: sources sit left because they
 * feed INTO the record, the employer sits right because it receives FROM it,
 * and the holder is centre because the whole thesis is that the record is the
 * middle of this picture. Numbering that arrangement fights it. The sequence
 * is real, but it belongs to the 01–05 prose list underneath — which is the
 * transcript EC-26 already requires to carry the meaning.
 */
function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--vt-scene-text-secondary)]">
      {children}
    </h3>
  );
}

'use client';

/**
 * WorkSurface — the no-NPI explainer at the centre of the homepage, recomposed
 * in D-01A as the beginning of **Profile in Motion**.
 *
 * The protagonist is the clinician's profile record, not a dashboard. It moves
 * through five permanent beats:
 *
 *   1  Identify       a masked NPI goes in
 *   2  Build          the record gains layers — identity, then facts that
 *                     arrive carrying the name of the source that returned
 *                     them, then the parts only the clinician can supply
 *   3  Choose         what still matters, each item labelled by its one owner
 *   4  Approve        VitalCV does the work it safely can and STOPS at a
 *                     visible consent gate that only the clinician opens
 *   5  Carry forward  a role that fits, and the employer's review desk
 *
 * Beat five ends at **review**. The employer decides; the scene does not decide
 * for them, does not light green, and does not resolve. That boundary is the
 * point of the last frame, not a caption on it.
 *
 * TRUTH. No real or fabricated NPI, no person, no source result, no match
 * score, no employer outcome, no counter. Facts render as skeleton bars beside
 * a real source name — that is what VitalCV reads, and the frame says
 * "illustrative" in its own chrome.
 *
 * ARCHITECTURE. The SERVER renders the completed story frame — every beat on —
 * so crawlers, no-script visitors and reduced-motion visitors get the whole
 * meaning with nothing to wait for. On mount, when motion is allowed, the
 * timeline resets the frame and replays it (~10.5s, first meaning inside 5s,
 * never blocking: the hero copy and the real NPI entry sit beside it the whole
 * time). Under prefers-reduced-motion the frame stays put and gains numbered
 * beat annotations.
 *
 * GEOMETRY (D-00 findings B-1…B-4 and the 0.0054 CLS). Every beat's space is
 * reserved by the grid at first paint: the resolution band is a real grid row
 * rather than an absolutely-positioned panel sliding over the columns, the
 * work feed and the consent gate stack instead of competing for a 101px
 * column, and each status cell reserves its widest label so swapping "Ready
 * for your approval" for "Approved" cannot reflow the row. Nothing in the
 * timeline changes layout — only opacity and transform.
 *
 * The timeline is JS-scheduled class toggling over CSS transitions — no
 * keyframes, no scroll coupling, no wheel listeners. Each beat announces
 * itself through HOME_BEAT_EVENT so the eyebrow's mono ticker narrates along.
 */

import { useCallback, useEffect, useRef } from 'react';

import { HOME_BEAT_EVENT } from '@/components/layout/Eyebrow';

const BEAT_LABELS: Record<number, string> = {
  1: 'Reading the NPI',
  2: 'Building the record',
  3: 'Ranking what remains',
  4: 'Waiting for your approval',
  5: 'Toward the employer',
};

const STATIC_LABEL = 'How VitalCV works';

/** Classes the timeline owns; reset strips them all before a run. */
const TIMELINE_CLASSES = [
  'on',
  'is-off',
  'is-done',
  'is-ready',
  'is-approved',
  'is-needs',
  'is-wait',
  'is-press',
  'is-pressed',
  'is-confirmed',
];

/** The server-rendered end state, per selector — restored by jumpToEnd(). */
const FINAL_ON = [
  '.ezh-seed',
  '.ezh-record',
  '.ezh-rec-cap',
  '.ezh-remains',
  '.ezh-workfeed',
  '.ezh-feedline.f1',
  '.ezh-feedline.f2',
  '.ezh-gate',
  '.ezh-sf-resolve',
  '.ezh-role-facts',
  '.ezh-applied',
  '.ezh-desk-in',
];

export default function WorkSurface() {
  const rootRef = useRef<HTMLElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const announce = useCallback((label: string) => {
    window.dispatchEvent(
      new CustomEvent(HOME_BEAT_EVENT, { detail: { label } }),
    );
  }, []);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const at = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const setDots = useCallback((beat: number) => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('.ezh-sf-dots i').forEach((dot, i) => {
      dot.classList.toggle('is-cur', i === beat - 1);
      dot.classList.toggle('is-past', i < beat - 1);
    });
  }, []);

  const reset = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    clearTimers();
    root.classList.remove('is-dim', 'is-static', 'is-played');
    root.removeAttribute('data-active-beat');
    root.querySelectorAll('.' + TIMELINE_CLASSES.join(',.')).forEach((el) => {
      TIMELINE_CLASSES.forEach((c) => el.classList.remove(c));
    });
    root.querySelectorAll('.ezh-sf-dots i').forEach((d) => {
      d.classList.remove('is-cur', 'is-past');
    });
  }, [clearTimers]);

  /** Restore the server frame (the completed story), optionally annotated. */
  const jumpToEnd = useCallback(
    (annotate: boolean) => {
      const root = rootRef.current;
      if (!root) return;
      reset();
      root.removeAttribute('data-motion');
      const stage = root.querySelector('.ezh-sf-stage');
      stage?.classList.add('is-off');
      for (const sel of FINAL_ON) root.querySelector(sel)?.classList.add('on');
      root.querySelectorAll('.ezh-g').forEach((g) => g.classList.add('on'));
      root.querySelectorAll('.ezh-rec-layer').forEach((l) => l.classList.add('on'));
      root.querySelectorAll('.ezh-fact').forEach((f) => f.classList.add('on'));
      root.querySelectorAll('.ezh-arow').forEach((r) => {
        r.classList.add('on');
        const final = r.getAttribute('data-final');
        if (final) r.classList.add(`is-${final}`);
      });
      root.querySelector('.ezh-gate')?.classList.add('is-confirmed');
      root.querySelector('.ezh-gate-btn')?.classList.add('is-pressed');
      root.classList.add('is-played');
      if (annotate) root.classList.add('is-static');
      root.setAttribute('data-active-beat', '5');
      root.querySelectorAll('.ezh-sf-dots i').forEach((d) => d.classList.add('is-past'));
    },
    [reset],
  );

  const play = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    reset();
    root.setAttribute('data-motion', 'playing');

    const q = (sel: string) => root.querySelector(sel);
    const qa = (sel: string) => Array.from(root.querySelectorAll(sel));
    const beat = (n: number) => {
      root.setAttribute('data-active-beat', String(n));
      announce(BEAT_LABELS[n]);
      setDots(n);
    };
    const rows = qa('.ezh-arow');

    /* beat one — identify: the masked seed types itself */
    beat(1);
    qa('.ezh-g').forEach((g, i) => {
      at(250 + i * 70, () => g.classList.add('on'));
    });
    at(1100, () => q('.ezh-npi-go')?.classList.add('is-press'));
    at(1400, () => q('.ezh-npi-go')?.classList.remove('is-press'));

    /* beat two — build: the record gains its layers */
    at(1500, () => {
      beat(2);
      q('.ezh-sf-stage')?.classList.add('is-off');
      q('.ezh-seed')?.classList.add('on');
    });
    at(1800, () => q('.ezh-record')?.classList.add('on'));
    qa('.ezh-rec-layer').forEach((l, i) => {
      at(2000 + i * 620, () => l.classList.add('on'));
    });
    qa('.ezh-fact').forEach((f, i) => {
      at(2200 + i * 380, () => f.classList.add('on'));
    });
    at(3900, () => q('.ezh-rec-cap')?.classList.add('on'));

    /* beat three — choose: what remains, by owner */
    at(4300, () => {
      beat(3);
      q('.ezh-remains')?.classList.add('on');
    });
    rows.forEach((r, i) => {
      at(4600 + i * 260, () => r.classList.add('on'));
    });

    /* beat four — approve: VitalCV works, then stops at the gate */
    at(6000, () => {
      beat(4);
      q('.ezh-workfeed')?.classList.add('on');
    });
    at(6300, () => {
      q('.ezh-feedline.f1')?.classList.add('on');
      rows[1]?.classList.add('is-done');
    });
    at(6550, () => rows[4]?.classList.add('is-wait'));
    at(6750, () => rows[3]?.classList.add('is-needs'));
    at(6950, () => {
      q('.ezh-feedline.f2')?.classList.add('on');
      rows[0]?.classList.add('is-done');
    });
    at(7350, () => {
      q('.ezh-gate')?.classList.add('on');
      rows[2]?.classList.add('is-ready');
    });
    at(8250, () => q('.ezh-gate-btn')?.classList.add('is-pressed'));
    at(8750, () => {
      q('.ezh-gate')?.classList.add('is-confirmed');
      rows[2]?.classList.remove('is-ready');
      rows[2]?.classList.add('is-approved');
    });

    /* beat five — carry forward: a role, then the employer's desk */
    at(9200, () => {
      beat(5);
      root.classList.add('is-dim');
      q('.ezh-sf-resolve')?.classList.add('on');
    });
    at(9600, () => q('.ezh-role-facts')?.classList.add('on'));
    at(9900, () => q('.ezh-applied')?.classList.add('on'));
    at(10200, () => q('.ezh-desk-in')?.classList.add('on'));

    at(10800, () => {
      root.classList.add('is-played');
      root.setAttribute('data-motion', 'done');
    });
    at(12000, () => announce(STATIC_LABEL));
  }, [announce, at, reset, setDots]);

  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rm.matches) {
      jumpToEnd(true);
    } else {
      const start = window.setTimeout(play, 400);
      timersRef.current.push(start);
    }
    const onChange = () => {
      if (rm.matches) jumpToEnd(true);
    };
    rm.addEventListener?.('change', onChange);
    return () => {
      rm.removeEventListener?.('change', onChange);
      clearTimers();
    };
  }, [play, jumpToEnd, clearTimers]);

  const onReplay = useCallback(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rm.matches) jumpToEnd(true);
    else play();
  }, [jumpToEnd, play]);

  return (
    <figure
      ref={rootRef}
      id="how-it-works"
      className="ezh-surface is-played"
      data-home-work-surface=""
      aria-label="How VitalCV works — an illustrated walkthrough in five steps: your NPI goes in, VitalCV builds a record from named public sources, ranks what remains by who owns it, does the work it safely can and then stops at your approval, and ends with a role and the employer's review. The employer decides the outcome."
    >
      <div className="ezh-sf-chrome">
        <span className="ezh-sf-cap">How VitalCV works &middot; illustrative &mdash; not a live result</span>
        <div className="ezh-sf-tools">
          <span className="ezh-sf-dots" aria-hidden="true">
            <i className="is-past" /><i className="is-past" /><i className="is-past" /><i className="is-past" /><i className="is-past" />
          </span>
          <button type="button" className="ezh-sf-replay" onClick={onReplay}>
            <span aria-hidden="true">&#8635;</span> Replay
          </button>
        </div>
      </div>

      <div className="ezh-sf-body">
        <div className="ezh-sf-cols">
          {/* ── left: the profile record, in layers ────────────────────── */}
          <div className="ezh-sf-left">
            <div className="ezh-seed on" data-beat="1">
              <span className="ezh-seed-k">NPI</span>
              <span className="ezh-seed-v" aria-hidden="true">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span>
              <span className="ezh-seed-tag">masked &middot; illustrative</span>
            </div>

            <div className="ezh-record on" data-beat="2">
              <p className="ezh-sf-h">Your record, as it builds</p>
              <p className="ezh-sf-hsub">Every layer says where it came from.</p>

              <div className="ezh-rec-layer on" data-layer="identity">
                <span className="ezh-rec-k">Identity</span>
                <div className="ezh-facts">
                  <div className="ezh-fact on">
                    <span className="ezh-fact-l">Name</span>
                    <span className="ezh-skel" style={{ width: '68%' }} aria-hidden="true" />
                    <span className="ezh-src">NPPES</span>
                  </div>
                </div>
              </div>

              <div className="ezh-rec-layer on" data-layer="sourced">
                <span className="ezh-rec-k">From named sources</span>
                <div className="ezh-facts">
                  <div className="ezh-fact on">
                    <span className="ezh-fact-l">Specialty</span>
                    <span className="ezh-skel" style={{ width: '56%' }} aria-hidden="true" />
                    <span className="ezh-src">NPPES</span>
                  </div>
                  <div className="ezh-fact on">
                    <span className="ezh-fact-l">Practice</span>
                    <span className="ezh-skel" style={{ width: '74%' }} aria-hidden="true" />
                    <span className="ezh-src">Practice info</span>
                  </div>
                  <div className="ezh-fact on">
                    <span className="ezh-fact-l">License record</span>
                    <span className="ezh-skel" style={{ width: '62%' }} aria-hidden="true" />
                    <span className="ezh-src">State board record</span>
                  </div>
                </div>
              </div>

              <div className="ezh-rec-layer on" data-layer="yours">
                <span className="ezh-rec-k">Yours to add</span>
                <div className="ezh-facts">
                  <div className="ezh-fact on is-open">
                    <span className="ezh-fact-l">Preferred location</span>
                    <span className="ezh-fact-open">Open &mdash; only you can answer</span>
                  </div>
                </div>
              </div>

              <div className="ezh-rec-layer on" data-layer="consent">
                <span className="ezh-rec-k">Shared only with your approval</span>
                <p className="ezh-rec-note">
                  Nothing in this record leaves it until you say so.
                </p>
              </div>

              <p className="ezh-rec-cap on">
                Values here are placeholders. Not every source has every answer, and the
                profile says so instead of guessing.
              </p>
            </div>
          </div>

          {/* ── right: what still matters, the work, and the gate ───────── */}
          <div className="ezh-sf-right">
            <div className="ezh-remains on" data-beat="3">
              <p className="ezh-sf-h">Here&rsquo;s what still matters</p>
              <p className="ezh-sf-hsub">A short list &mdash; each item labeled by who owns it.</p>
              <ul className="ezh-arows">
                <li className="ezh-arow on is-done" data-final="done">
                  <span className="ezh-arow-t">Assemble a work history draft</span>
                  <span className="ezh-chip">VitalCV</span>
                  <span className="ezh-stz">
                    <span className="ezh-st ezh-st-idle">&middot;</span>
                    <span className="ezh-st ezh-st-done"><i className="ezh-ck" aria-hidden="true">&#10003;</i> Done by VitalCV</span>
                  </span>
                </li>
                <li className="ezh-arow on is-done" data-final="done">
                  <span className="ezh-arow-t">Check the state license record</span>
                  <span className="ezh-chip">VitalCV</span>
                  <span className="ezh-stz">
                    <span className="ezh-st ezh-st-idle">&middot;</span>
                    <span className="ezh-st ezh-st-done"><i className="ezh-ck" aria-hidden="true">&#10003;</i> Done by VitalCV</span>
                  </span>
                </li>
                <li className="ezh-arow on is-approved" data-final="approved">
                  <span className="ezh-arow-t">Send your profile to an interested employer</span>
                  <span className="ezh-chip">Your approval</span>
                  <span className="ezh-stz">
                    <span className="ezh-st ezh-st-idle">&middot;</span>
                    <span className="ezh-st ezh-st-ready">Ready for you</span>
                    <span className="ezh-st ezh-st-approved"><i className="ezh-ck" aria-hidden="true">&#10003;</i> You approved it</span>
                  </span>
                </li>
                <li className="ezh-arow on is-needs" data-final="needs">
                  <span className="ezh-arow-t">Occupational health forms</span>
                  <span className="ezh-chip">You</span>
                  <span className="ezh-stz">
                    <span className="ezh-st ezh-st-idle">&middot;</span>
                    <span className="ezh-st ezh-st-needs">Needs you</span>
                  </span>
                </li>
                <li className="ezh-arow on is-wait" data-final="wait">
                  <span className="ezh-arow-t">Interview and facility sign-off</span>
                  <span className="ezh-chip">Employer</span>
                  <span className="ezh-stz">
                    <span className="ezh-st ezh-st-idle">&middot;</span>
                    <span className="ezh-st ezh-st-wait">Waiting on the employer</span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="ezh-workfeed on">
              <span className="ezh-k">VitalCV working</span>
              <p className="ezh-feedline f1 on"><i className="ezh-ck" aria-hidden="true">&#10003;</i> State license record checked</p>
              <p className="ezh-feedline f2 on"><i className="ezh-ck" aria-hidden="true">&#10003;</i> Work history draft assembled</p>
            </div>

            {/* the consent gate — the one place the scene stops for a person */}
            <div className="ezh-gate on is-confirmed" data-beat="4">
              <p className="ezh-gate-head">
                <span className="ezh-h-wait">Your approval</span>
                <span className="ezh-h-ok">You approved &mdash; VitalCV continues</span>
              </p>
              <p className="ezh-gate-body">Send your profile to an interested employer.</p>
              <span className="ezh-gate-act">
                <span className="ezh-gate-btn is-pressed" aria-hidden="true">Approve</span>
                <span className="ezh-gate-done"><span aria-hidden="true">&#10003;</span> Profile sent</span>
              </span>
              <p className="ezh-gate-note">Illustrative &mdash; in the product, nothing moves without you.</p>
            </div>
          </div>
        </div>

        {/* ── beat five — a role, then the employer's review desk ───────── */}
        <div className="ezh-sf-resolve on" data-beat="5">
          <div className="ezh-res-role">
            <p className="ezh-sf-h">A role that fits</p>
            <div className="ezh-role-facts on">
              <span className="ezh-skel" style={{ width: '70%' }} aria-hidden="true" />
              <span className="ezh-skel" style={{ width: '46%' }} aria-hidden="true" />
            </div>
            <p className="ezh-applied on"><span className="ezh-ck" aria-hidden="true">&#10003;</span> Applied with VitalCV</p>
            <p className="ezh-role-cap">Drawn from the record above &mdash; illustrative.</p>
          </div>

          <div className="ezh-res-desk">
            <p className="ezh-sf-h">The employer&rsquo;s review</p>
            <div className="ezh-desk">
              <span className="ezh-desk-in on">
                <i className="ezh-desk-doc" aria-hidden="true" />
                Your record, as you approved it
              </span>
              <span className="ezh-desk-line" aria-hidden="true" />
              <span className="ezh-desk-out">The employer decides</span>
            </div>
            <p className="ezh-desk-cap">
              This is where VitalCV stops. The employer reviews, asks what they need to ask,
              and decides &mdash; on their own timeline.
            </p>
          </div>
        </div>

        {/* beat one — the typing seed; last in DOM so it covers the frame */}
        <div className="ezh-sf-stage is-off" aria-hidden="true">
          <div className="ezh-npi-illus">
            <span className="ezh-k">Your NPI</span>
            <div className="ezh-glyphs">
              <span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" /><span className="ezh-g on" />
            </div>
            <span className="ezh-npi-go">Find what&rsquo;s on record</span>
          </div>
          <p className="ezh-stage-cap">Illustrative &mdash; no real numbers, no real people.</p>
        </div>
      </div>

      <figcaption className="ezh-rm-legend">
        The five steps at once: your NPI &middot; the record VitalCV builds from named sources
        &middot; what remains, by owner &middot; your approval &middot; a role, and the
        employer&rsquo;s review.
      </figcaption>
    </figure>
  );
}

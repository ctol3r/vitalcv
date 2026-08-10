'use client';

/**
 * ProcessStory — "What VitalCV is", the deep five-chapter explainer (UX-04).
 *
 * The hero's WorkSurface plays the whole story in ~10 seconds beside the real
 * NPI entry. This section is the same story told at full size: each of the
 * five permanent beats (EC-27 — Identify → Build → Choose → Apply → Carry
 * forward) becomes its own chapter with explanatory copy and a larger scene,
 * so a visitor who wants to actually understand the product gets the whole
 * process without leaving the page.
 *
 * TRUTH (EC-25, applied per scene). No real or well-formed NPI — the seed is
 * ten masked glyphs. Facts are skeleton bars beside the name of a source that
 * is actually integrated (NPPES, the federal exclusion list, state license
 * records). No counts, scores, or metrics. The send is labeled illustrative.
 * Chapter five ends at the employer's review and NEVER resolves — the desk
 * receives; deciding belongs to the employer. Every scene labels itself
 * "Illustrative" in its own chrome.
 *
 * ARCHITECTURE (house pattern, same as WorkSurface). The server renders every
 * chapter COMPLETE (`is-play` present in SSR), so crawlers, no-script and
 * reduced-motion visitors get the full meaning with nothing to wait for. On
 * the client, when motion is allowed, each chapter resets and replays once as
 * it enters the viewport — CSS transitions under staggered delays, no
 * keyframes, no loops (EC-29), no scroll coupling. Under
 * prefers-reduced-motion the completed frames stay put and gain numbered beat
 * annotations. Replay is an explicit control (≥44px).
 *
 * ATMOSPHERE (EC-20 gradient row, as amended A-1). One travelling
 * `--vt-scene-glow`: every chapter has a glow layer, but only the chapter
 * holding `is-glow` lights it — the observer hands the light to each chapter
 * as it plays, so at most one glow is ever visible no matter the viewport
 * geometry. SSR lights chapter one only. The glow carries no meaning —
 * removing it costs nothing but atmosphere (EC-4).
 */

import { useCallback, useEffect, useRef } from 'react';

interface Chapter {
  n: 1 | 2 | 3 | 4 | 5;
  key: string;
  title: string;
  body: string;
  sceneLabel: string;
}

const CHAPTERS: readonly Chapter[] = [
  {
    n: 1,
    key: 'identify',
    title: 'Start with the number you already have.',
    body:
      'Every U.S. clinician has an NPI. That ten-digit number is the only seed VitalCV needs — no forms to fill, no résumé to upload, and no account just to see what the public record says.',
    sceneLabel:
      'A masked NPI enters, and a profile spine forms beneath it. Illustrative — no real numbers.',
  },
  {
    n: 2,
    key: 'build',
    title: 'The profile builds itself from named sources.',
    body:
      'Identity from the NPPES registry. The federal exclusion list. State license records. Every fact arrives carrying the name of the source that returned it — and where a source has not answered, the profile shows the gap instead of papering over it.',
    sceneLabel:
      'The profile gains layers; each fact is a placeholder bar beside the source that returned it, and one slot stays visibly open where no source has answered.',
  },
  {
    n: 3,
    key: 'choose',
    title: 'Everything that remains has exactly one owner.',
    body:
      'What is left is a short, honest list. Each item is labeled: work VitalCV handles on its own, decisions that wait for your approval, forms only you can complete, and calls that belong to the employer.',
    sceneLabel:
      'Remaining items sort into four owner lanes: VitalCV handles, your approval, only you, the employer decides.',
  },
  {
    n: 4,
    key: 'apply',
    title: 'The agent works — and stops at your approval.',
    body:
      'VitalCV drafts your work history, checks public records, tracks renewal dates. The moment anything would leave your profile — sending it to an employer, requesting a reference — the work stops and waits for you. Nothing moves without your say.',
    sceneLabel:
      'Work resolves line by line, then holds at a consent gate until an approval is pressed. Illustrative — in the product, nothing moves without you.',
  },
  {
    n: 5,
    key: 'carry',
    title: 'Your work travels with you. You do not start over.',
    body:
      'When you apply, the employer receives exactly what you approved, and the review is theirs to make. Whatever they decide, the profile you built stays yours — ready for the next role, without starting from zero.',
    sceneLabel:
      'A lighter copy carrying only approved rows travels to the employer’s review desk; the complete profile stays with you. The desk receives — the employer decides.',
  },
] as const;

/** Ten masked glyphs — the seed never contains a digit (EC-25.1). */
function MaskedSeed() {
  return (
    <span className="ezh-st-seedv" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className="ezh-st-g" />
      ))}
    </span>
  );
}

function SceneIdentify() {
  return (
    <div className="ezh-st-scene ezh-st-sc1" aria-hidden="true">
      <div className="ezh-st-seed">
        <span className="ezh-st-seedk">NPI</span>
        <MaskedSeed />
        <span className="ezh-st-tag">masked &middot; illustrative</span>
      </div>
      <span className="ezh-st-spine" />
      <div className="ezh-st-nascent">
        <span className="ezh-st-nascent-edge" />
        <span className="ezh-st-nascent-cap">Your profile begins here</span>
      </div>
    </div>
  );
}

function SceneBuild() {
  return (
    <div className="ezh-st-scene ezh-st-sc2" aria-hidden="true">
      <div className="ezh-st-record">
        <span className="ezh-st-rec-edge" />
        <div className="ezh-st-fact f1">
          <span className="ezh-skel" style={{ width: '64%' }} />
          <span className="ezh-src">NPPES</span>
        </div>
        <div className="ezh-st-fact f2">
          <span className="ezh-skel" style={{ width: '52%' }} />
          <span className="ezh-src">Exclusion list</span>
        </div>
        <div className="ezh-st-fact f3">
          <span className="ezh-skel" style={{ width: '70%' }} />
          <span className="ezh-src">State board record</span>
        </div>
        <div className="ezh-st-fact f4 is-open">
          <span className="ezh-st-open-slot">No answer yet &mdash; shown open</span>
        </div>
      </div>
      <div className="ezh-st-sources">
        <span className="ezh-st-srcnode s1">NPPES registry</span>
        <span className="ezh-st-srcnode s2">Federal exclusion list</span>
        <span className="ezh-st-srcnode s3">State license record</span>
      </div>
    </div>
  );
}

function SceneChoose() {
  return (
    <div className="ezh-st-scene ezh-st-sc3" aria-hidden="true">
      <div className="ezh-st-lane l1">
        <span className="ezh-st-lane-k">VitalCV handles</span>
        <span className="ezh-st-item i1">Work history draft</span>
        <span className="ezh-st-item i2">License record check</span>
      </div>
      <div className="ezh-st-lane l2">
        <span className="ezh-st-lane-k">Your approval</span>
        <span className="ezh-st-item i3">Send your profile</span>
      </div>
      <div className="ezh-st-lane l3">
        <span className="ezh-st-lane-k">Only you</span>
        <span className="ezh-st-item i4">Health forms</span>
      </div>
      <div className="ezh-st-lane l4">
        <span className="ezh-st-lane-k">The employer decides</span>
        <span className="ezh-st-item i5">Interview &amp; sign-off</span>
      </div>
    </div>
  );
}

function SceneApply() {
  return (
    <div className="ezh-st-scene ezh-st-sc4" aria-hidden="true">
      <div className="ezh-st-feed">
        <span className="ezh-st-feedk">VitalCV working</span>
        <p className="ezh-st-line w1">
          <i className="ezh-ck">&#10003;</i> State license record checked
        </p>
        <p className="ezh-st-line w2">
          <i className="ezh-ck">&#10003;</i> Work history draft assembled
        </p>
        <p className="ezh-st-line w3">
          <i className="ezh-ck">&#10003;</i> Renewal dates on watch
        </p>
      </div>
      <div className="ezh-st-gate">
        <span className="ezh-st-gate-wait">Waiting for you</span>
        <span className="ezh-st-gate-what">Send your profile to an interested employer</span>
        <span className="ezh-st-gate-btn">Approve</span>
        <span className="ezh-st-gate-ok">
          <i className="ezh-ck">&#10003;</i> You approved &mdash; VitalCV continues
        </span>
      </div>
    </div>
  );
}

function SceneCarry() {
  return (
    <div className="ezh-st-scene ezh-st-sc5" aria-hidden="true">
      <div className="ezh-st-keep">
        <span className="ezh-st-rec-edge" />
        <span className="ezh-st-keep-k">Your complete profile</span>
        <span className="ezh-skel" style={{ width: '76%' }} />
        <span className="ezh-skel" style={{ width: '58%' }} />
        <span className="ezh-skel" style={{ width: '64%' }} />
        <span className="ezh-st-keep-cap">Stays with you</span>
      </div>
      <span className="ezh-st-arc" />
      <div className="ezh-st-travel">
        <span className="ezh-st-rec-edge" />
        <span className="ezh-st-keep-k">What you approved</span>
        <span className="ezh-skel" style={{ width: '66%' }} />
        <span className="ezh-skel" style={{ width: '44%' }} />
      </div>
      <div className="ezh-st-desk">
        <span className="ezh-st-desk-k">The employer&rsquo;s review</span>
        <span className="ezh-st-desk-verdict">The employer decides</span>
      </div>
    </div>
  );
}

const SCENES: Record<Chapter['key'], () => React.JSX.Element> = {
  identify: SceneIdentify,
  build: SceneBuild,
  choose: SceneChoose,
  apply: SceneApply,
  carry: SceneCarry,
};

export default function ProcessStory() {
  const rootRef = useRef<HTMLElement | null>(null);
  const playedRef = useRef<Set<number>>(new Set());

  /** Hand the single travelling glow to one chapter (EC-20: one per viewport). */
  const claimGlow = useCallback((article: HTMLElement) => {
    const root = rootRef.current;
    root?.querySelectorAll('.ezh-st-ch.is-glow').forEach((c) => c.classList.remove('is-glow'));
    article.classList.add('is-glow');
  }, []);

  /** Replay one chapter: strip the played state, reflow, restore it. */
  const replay = useCallback(
    (article: HTMLElement) => {
      claimGlow(article);
      article.classList.add('is-reset');
      article.classList.remove('is-play');
      // Force the hidden frame to commit before transitions re-enable.
      void article.offsetWidth;
      article.classList.remove('is-reset');
      article.classList.add('is-play');
    },
    [claimGlow],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('.ezh-st-ch'));

    if (rm.matches) {
      root.classList.add('is-static');
      return;
    }

    // Motion allowed: each chapter replays once as it enters the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const n = Number(el.dataset.chapter);
          if (playedRef.current.has(n)) {
            // Already told its story — the travelling light still follows.
            claimGlow(el);
            continue;
          }
          playedRef.current.add(n);
          replay(el);
        }
      },
      { threshold: 0.3 },
    );
    chapters.forEach((c) => observer.observe(c));

    const onChange = () => {
      if (rm.matches) {
        observer.disconnect();
        root.classList.add('is-static');
        chapters.forEach((c) => c.classList.add('is-play'));
      }
    };
    rm.addEventListener?.('change', onChange);
    return () => {
      observer.disconnect();
      rm.removeEventListener?.('change', onChange);
    };
  }, [claimGlow, replay]);

  return (
    <section
      ref={rootRef}
      className="ezh-story"
      data-header-theme="dark"
      data-home-process-story=""
      aria-labelledby="ezh-story-h"
    >
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <span className="ezh-k">What VitalCV is</span>
          <h2 id="ezh-story-h">One profile. One process. Five chapters.</h2>
        </div>
        <p className="ezh-sec-sub ezh-st-lede">
          VitalCV is a working profile for U.S. clinicians. It starts from your NPI, builds from
          public records that name their sources, and then works like an agent on the
          administrative side of getting hired &mdash; always stopping at your approval before
          anything leaves. Here is the whole process, start to finish.
        </p>

        {CHAPTERS.map((ch) => {
          const Scene = SCENES[ch.key];
          return (
            <article
              key={ch.key}
              // Server renders the finished frame; the client replays on entry.
              // SSR lights only chapter one's glow; the observer moves it.
              className={`ezh-st-ch is-play${ch.n === 1 ? ' is-glow' : ''}${ch.n % 2 === 0 ? ' is-flip' : ''}`}
              data-chapter={ch.n}
              aria-labelledby={`ezh-st-h${ch.n}`}
            >
              <div className="ezh-st-copy">
                <span className="ezh-st-num" aria-hidden="true">
                  0{ch.n}
                </span>
                <span className="ezh-st-beat">{`Chapter ${ch.n} of 5`}</span>
                <h3 id={`ezh-st-h${ch.n}`}>{ch.title}</h3>
                <p>{ch.body}</p>
              </div>
              <figure className="ezh-st-stage" aria-label={ch.sceneLabel}>
                <span className="ezh-st-glow" aria-hidden="true" />
                <div className="ezh-st-frame">
                  <div className="ezh-st-chrome">
                    <span className="ezh-st-cap">Illustrative &mdash; not a live result</span>
                    <button
                      type="button"
                      className="ezh-st-replay"
                      onClick={(e) => {
                        const article = (e.currentTarget as HTMLElement).closest('.ezh-st-ch');
                        if (article instanceof HTMLElement) replay(article);
                      }}
                    >
                      <span aria-hidden="true">&#8635;</span> Replay
                    </button>
                  </div>
                  <Scene />
                </div>
                <figcaption className="ezh-st-legend">{ch.sceneLabel}</figcaption>
              </figure>
            </article>
          );
        })}

        <p className="ezh-st-close">
          That is the whole product: a profile you own, work that stops at your approval, and
          evidence that travels with you. The employer&rsquo;s decision stays the
          employer&rsquo;s &mdash; VitalCV makes sure it is made about your real record.
        </p>
      </div>
    </section>
  );
}

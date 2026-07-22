'use client';

import * as React from 'react';

import { checkNpi } from '@/lib/vital/npi';
import { detectCapabilities, resolveTier, type SceneTier } from '@/components/home/scene/capabilities';
import { EvidenceAtmosphere } from './EvidenceAtmosphere';
import { FILM_SCENES, sceneAt } from './scenes';
import { useFilmProgress } from './useFilmProgress';

/**
 * COMPETE-2 visual-reference spike.
 *
 * ONE isolated full-viewport scene composition proving the horizontal-film
 * grammar before any production routing changes:
 *
 *   · Cloud Dancer paper (#F0EEE9) as the unifying field
 *   · a source-fragment evidence atmosphere — NOT a graph (see atmosphere.ts)
 *   · kinetic editorial type
 *   · a cursor that acts as a reading light over evidence
 *   · ONE horizontal scene transition (Arrival → Recognition)
 *
 * Fallback contract (composition-ownership §3): the DOM below is a linear,
 * SSR-complete vertical document. The film is a TRANSFORM applied to it after
 * hydration on eligible desktop — never a different document. With no JS, a
 * coarse pointer, reduced motion, or a narrow viewport, what remains is an
 * ordinary readable page in the same order.
 *
 * Scope: this is a composition spike, not the product. The NPI field proves
 * that the control can be a designed object inside a scene rather than a boxed
 * form beside a visual; it validates locally and performs NO lookup. Wiring
 * real returned state is COMPETE-3.
 */

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

/**
 * Kinetic editorial type. Each word carries its own delay off the scene's
 * local progress, so the phrase assembles rather than fading in as a block.
 *
 * The full phrase is always in the DOM as one text node for assistive tech
 * (the spans are aria-hidden), so the kinetic treatment can never cost a
 * screen-reader user the sentence.
 */
function KineticPhrase({ text, local, live }: { text: string; local: number; live: boolean }) {
  const words = React.useMemo(() => text.split(' '), [text]);

  return (
    <span className="film-kinetic">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="film-kinetic-words">
        {words.map((word, i) => {
          const start = (i / Math.max(1, words.length)) * 0.45;
          const t = live ? Math.min(1, Math.max(0, (local - start) / 0.55)) : 1;
          return (
            <span
              key={`${word}-${i}`}
              className="film-kinetic-word"
              style={{
                opacity: t,
                transform: `translate3d(0, ${(1 - t) * 0.42}em, 0)`,
              }}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function FilmSpike() {
  const runwayRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const tier = useSceneTier();

  // Reduced motion resolves to the 'static' tier, which is also the signal to
  // stop driving the film — one condition, not two that can disagree.
  const { progress, eligible, ready } = useFilmProgress(runwayRef, tier !== 'static');

  const [pointer, setPointer] = React.useState<{ x: number; y: number } | null>(null);
  const [npi, setNpi] = React.useState('');

  // Layout mode follows ELIGIBILITY, never `pinned` — see useFilmProgress.
  const isFilm = ready && eligible && tier !== 'static';
  const { index, local } = sceneAt(progress);

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Pointer effects are a fine-pointer enhancement only.
    if (event.pointerType !== 'mouse') return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPointer({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }, []);

  const npiCheck = checkNpi(npi);
  const digits = npi.replace(/\D/g, '').slice(0, 10);

  return (
    <div className="film" data-film-mode={isFilm ? 'film' : 'vertical'} data-film-tier={tier}>
      {/* Route-scoped paper. Cloud Dancer is the unifying field; it unmounts
          with the route so no other surface inherits it. */}
      <style>{'body{background:var(--vt-cloud-dancer,#F0EEE9)}'}</style>

      <div ref={runwayRef} className="film-runway">
        <div
          ref={stageRef}
          className="film-stage"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setPointer(null)}
        >
          <EvidenceAtmosphere progress={progress} tier={tier} pointer={pointer} />

          {/* The cursor as a reading light. Decorative, pointer-events-none,
              and absent entirely unless a mouse is actually present. */}
          {pointer && tier !== 'static' ? (
            <div
              aria-hidden="true"
              className="film-readinglight"
              style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
            />
          ) : null}

          <div
            className="film-track"
            style={
              isFilm
                ? { transform: `translate3d(-${progress * (FILM_SCENES.length - 1) * 100}%, 0, 0)` }
                : undefined
            }
          >
            {FILM_SCENES.map((scene, i) => {
              // In vertical mode every scene is fully seated; in film mode only
              // the active one is animating.
              const isActive = i === index || (i === index + 1 && local > 0);
              const sceneLocal = !isFilm ? 1 : i === index ? 1 - local : i === index + 1 ? local : 0;

              return (
                <section
                  key={scene.id}
                  className="film-scene"
                  data-film-scene={scene.id}
                  data-film-active={isFilm && isActive ? '' : undefined}
                  aria-label={scene.label}
                >
                  <div className="film-copy">
                    <h2 className="film-phrase">
                      <KineticPhrase
                        text={scene.phrase}
                        local={sceneLocal}
                        live={isFilm}
                      />
                    </h2>
                    {scene.support ? <p className="film-support">{scene.support}</p> : null}

                    {scene.id === 'arrival' ? (
                      <div className="film-npi">
                        <label htmlFor="film-npi-input" className="film-npi-label">
                          Start with your NPI
                        </label>
                        {/* A designed object inside the scene — a ruled line on
                            paper, not a boxed form card beside a visual. */}
                        <input
                          id="film-npi-input"
                          className="film-npi-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="10-digit NPI"
                          value={npi}
                          onChange={(event) => setNpi(event.target.value)}
                          aria-describedby="film-npi-hint"
                        />
                        <p id="film-npi-hint" className="film-npi-hint">
                          {digits.length === 10
                            ? (npiCheck.validity === 'valid'
                                ? 'Checksum looks right.'
                                : (npiCheck.reason ?? 'Check the number for a typo.'))
                            : `${digits.length}/10 digits`}
                        </p>
                        <p className="film-note">
                          Composition spike — this field validates the number
                          locally and does not look anything up.
                        </p>
                      </div>
                    ) : null}

                    {scene.id === 'recognition' ? (
                      <p className="film-note">
                        Nothing personal is shown until a real lookup returns.
                        This scene renders abstract choreography only.
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

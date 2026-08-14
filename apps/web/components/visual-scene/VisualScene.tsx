'use client';

import * as React from 'react';

import {
  sceneEntry,
  scenePoster,
  sceneRouteVariant,
  type SceneId,
  type SceneRouteVariantId,
} from './manifest';

/**
 * VisualScene — the one rendering path for public visual scenes.
 * CC-06 / VIS-05, implementing Experience Constitution EC-26 and EC-29.
 *
 * The contract, enforced at the type level:
 *  - `kind: 'stateful'` REQUIRES `state` (real returned app state — there is
 *    no fixture path and no optimistic path);
 *  - `kind: 'decorative' | 'process'` FORBIDS `state`;
 *  - process and stateful scenes render their transcript as adjacent text.
 *
 * Motion discipline:
 *  - The server render is always the poster composition — motion can only
 *    mount client-side, after the scene is visible (IntersectionObserver),
 *    the visitor does not prefer reduced motion, data-saver is off, and the
 *    browser can actually play the format. Any failure of those checks means
 *    the composed static visual IS the experience, not a degraded one.
 *  - Single play, then settle; an explicit Replay control appears. Nothing
 *    loops (EC-29).
 *  - The aspect box is reserved before any asset loads — no layout shift.
 */

/** Real returned app state for a stateful scene. Never fabricated. */
export interface SceneState {
  status: 'ready' | 'unknown' | 'unavailable' | 'error';
  /** Short, human caption derived from the real state ("3 sources read"). */
  caption?: string;
}

interface SceneBaseProps {
  scene: SceneId;
  /** Manifest-owned route crop; never a route-local asset override. */
  routeVariant?: SceneRouteVariantId;
  mode?: 'auto' | 'static' | 'motion';
  priority?: 'hero' | 'inline' | 'background';
  className?: string;
}

export type VisualSceneProps =
  | (SceneBaseProps & { kind: 'decorative'; state?: never })
  | (SceneBaseProps & { kind: 'process'; state?: never })
  | (SceneBaseProps & { kind: 'stateful'; state: SceneState });

const STATE_WORD: Record<SceneState['status'], string> = {
  ready: 'Current state',
  unknown: 'Not yet known',
  unavailable: 'Temporarily unavailable',
  error: 'Could not be read',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function saveDataOn(): boolean {
  if (typeof navigator === 'undefined') return true;
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  return conn?.saveData === true;
}

export function VisualScene(props: VisualSceneProps) {
  const { scene, routeVariant, mode = 'auto', priority = 'inline', className } = props;
  const entry = sceneEntry(scene);
  const variant = entry ? sceneRouteVariant(entry, routeVariant) : undefined;
  const poster = entry ? scenePoster(entry, variant) : undefined;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // 'poster' → 'playing' → 'finished'; motion is opt-in and one-shot.
  const [phase, setPhase] = React.useState<'poster' | 'playing' | 'finished'>('poster');
  const [motionAllowed, setMotionAllowed] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Capability + preference detection runs only on the client, after mount.
  React.useEffect(() => {
    if (mode === 'static') return;
    if (!entry || entry.motion.length === 0) return;
    if (prefersReducedMotion() || saveDataOn()) return;
    const video = document.createElement('video');
    const playable = entry.motion.some((m) =>
      m.format === 'webm' ? video.canPlayType('video/webm') !== '' : m.format === 'mp4' ? video.canPlayType('video/mp4') !== '' : false,
    );
    if (playable) setMotionAllowed(true);
  }, [entry, mode]);

  // Intersection-aware: assets stay unloaded until the scene is on screen.
  React.useEffect(() => {
    if (!motionAllowed || typeof IntersectionObserver === 'undefined') return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [motionAllowed]);

  if (!entry || !poster) return null;

  // Once motion has mounted it stays mounted (a finished video settles on
  // its last frame); 'failed' is the only path back to poster-only.
  const showMotion = motionAllowed && visible && !failed;
  const transcript = entry.kind === 'decorative' ? undefined : (variant?.transcript ?? entry.transcript);
  const altText = variant?.altText ?? entry.altText;
  const stateForCaption = props.kind === 'stateful' ? props.state : undefined;

  return (
    <figure
      className={className}
      data-scene={scene}
      data-scene-kind={entry.kind}
      data-scene-priority={priority}
      data-scene-variant={variant?.id}
      style={{ margin: 0 }}
    >
      <div
        ref={containerRef}
        // The reserved box: aspect ratio comes from the manifest, so the
        // element occupies its final size before any asset arrives (no CLS).
        style={{
          position: 'relative',
          aspectRatio: `${variant?.aspect.w ?? entry.aspect.w} / ${variant?.aspect.h ?? entry.aspect.h}`,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- manifest-validated static asset with a reserved box */}
        <img
          src={poster.path}
          alt={altText}
          aria-hidden={entry.kind === 'decorative' ? true : undefined}
          fetchPriority={priority === 'hero' ? 'high' : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: variant?.objectPosition,
          }}
        />
        {showMotion && entry.motion.length > 0 ? (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            poster={poster.path}
            onEnded={() => setPhase('finished')}
            onError={() => {
              // A broken asset never leaves a broken scene: fall back to the
              // composed poster permanently for this mount.
              setFailed(true);
              setPhase('poster');
            }}
            onCanPlay={() => {
              if (phase === 'poster') {
                setPhase('playing');
                void videoRef.current?.play().catch(() => setFailed(true));
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: variant?.objectPosition,
            }}
          >
            {entry.motion.map((m) => (
              <source key={m.path} src={m.path} type={m.format === 'webm' ? 'video/webm' : 'video/mp4'} />
            ))}
          </video>
        ) : null}
        {phase === 'finished' && !failed ? (
          <button
            type="button"
            onClick={() => {
              setPhase('playing');
              const video = videoRef.current;
              if (video) {
                video.currentTime = 0;
                void video.play().catch(() => setFailed(true));
              }
            }}
            aria-label={`Replay: ${entry.title}`}
            style={{ position: 'absolute', right: 12, bottom: 12, minWidth: 44, minHeight: 44 }}
          >
            Replay
          </button>
        ) : null}
      </div>
      {stateForCaption || transcript ? (
        <figcaption>
          {stateForCaption ? (
            // EC-4: the state is words in the DOM, never only artwork.
            <p data-scene-state={stateForCaption.status}>
              {STATE_WORD[stateForCaption.status]}
              {stateForCaption.caption ? ` — ${stateForCaption.caption}` : ''}
            </p>
          ) : null}
          {transcript ? <p data-scene-transcript>{transcript}</p> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

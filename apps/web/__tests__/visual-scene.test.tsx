// @vitest-environment jsdom
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  MOTION_BUDGET_BYTES,
  POSTER_BUDGET_BYTES,
  SCENE_MANIFEST,
  type SceneManifestEntry,
} from '@/components/visual-scene/manifest';
import { validateManifest, validateSceneEntry } from '@/components/visual-scene/validateManifest';
import { VisualScene } from '@/components/visual-scene/VisualScene';

/**
 * CC-06 / VIS-05 — the VisualScene runtime and its EC-29 asset gate.
 *
 * Two layers:
 *  1. Asset validation runs against the real manifest and real files under
 *     public/ — an oversized, unlabeled, missing, or fallback-less asset
 *     fails Web Quality (a required CI context).
 *  2. The component contract: the server render is ALWAYS the composed
 *     poster (no <video>, no autoplay anywhere) — which is what makes
 *     reduced-motion, data-saver, and no-JS first-class compositions rather
 *     than degraded states. Motion is a client-side opt-in mounted only
 *     after preference + capability + visibility checks.
 */

const WEB_ROOT = join(__dirname, '..');

function statPublic(publicPath: string): number | null {
  try {
    return statSync(join(WEB_ROOT, 'public', publicPath)).size;
  } catch {
    return null;
  }
}

describe('EC-29 asset gate (real manifest, real files)', () => {
  it('every manifest entry is labeled, present, and within budget', () => {
    expect(SCENE_MANIFEST.length).toBeGreaterThan(0);
    expect(validateManifest(SCENE_MANIFEST, statPublic)).toEqual([]);
  });

  it('placeholder posters stay far under the poster budget', () => {
    for (const entry of SCENE_MANIFEST) {
      const bytes = statPublic(entry.poster.path);
      expect(bytes).not.toBeNull();
      expect(bytes!).toBeLessThanOrEqual(POSTER_BUDGET_BYTES);
    }
  });
});

describe('the gate actually gates — deliberately broken entries fail', () => {
  const base = SCENE_MANIFEST.find((e) => e.kind === 'process')!;

  it('rejects an oversized poster', () => {
    const errors = validateSceneEntry(base, () => POSTER_BUDGET_BYTES + 1);
    expect(errors.some((e) => e.includes('over the'))).toBe(true);
  });

  it('rejects a missing poster file', () => {
    const errors = validateSceneEntry(base, () => null);
    expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('rejects an unlabeled asset (no license/origin)', () => {
    const broken: SceneManifestEntry = {
      ...base,
      poster: { ...base.poster, license: '', origin: ' ' },
    };
    const errors = validateSceneEntry(broken, statPublic);
    expect(errors.some((e) => e.includes('missing source/license/origin'))).toBe(true);
  });

  it('rejects a process scene without a transcript, and a decorative one with alt text', () => {
    const noTranscript: SceneManifestEntry = { ...base, transcript: undefined };
    expect(validateSceneEntry(noTranscript, statPublic).some((e) => e.includes('need a transcript'))).toBe(true);

    const decorated = SCENE_MANIFEST.find((e) => e.kind === 'decorative')!;
    const loudDecoration: SceneManifestEntry = { ...decorated, altText: 'look at me' };
    expect(validateSceneEntry(loudDecoration, statPublic).some((e) => e.includes('empty alt text'))).toBe(true);
  });

  it('rejects an oversized motion asset', () => {
    const withMotion: SceneManifestEntry = {
      ...base,
      motion: [{ path: '/scenes/x.webm', format: 'webm', source: 'original', license: 'x', origin: 'x' }],
    };
    const errors = validateSceneEntry(withMotion, (p) =>
      p.endsWith('.webm') ? MOTION_BUDGET_BYTES + 1 : statPublic(p),
    );
    expect(errors.some((e) => e.includes('over the'))).toBe(true);
  });
});

describe('server render is the composed static scene (EC-26)', () => {
  it('never contains video or autoplay, and reserves the aspect box', () => {
    const html = renderToStaticMarkup(
      <VisualScene scene="workbench_window" kind="process" />,
    );
    expect(html).not.toContain('<video');
    expect(html).not.toContain('autoplay');
    expect(html).toContain('aspect-ratio:4 / 3');
    expect(html).toContain('/scenes/workbench-window-placeholder.svg');
  });

  it('a process scene renders its transcript as adjacent text', () => {
    const html = renderToStaticMarkup(<VisualScene scene="workbench_window" kind="process" />);
    expect(html).toContain('data-scene-transcript');
    expect(html).toContain('Nothing leaves the workspace without that explicit step.');
  });

  it('the homepage documentary crop stays manifest-owned and provenance-bound', () => {
    const html = renderToStaticMarkup(
      <VisualScene
        scene="journey_film"
        kind="process"
        routeVariant="home_documentary"
        priority="hero"
      />,
    );
    expect(html).toContain('data-scene-variant="home_documentary"');
    expect(html).toContain('aspect-ratio:4 / 5');
    expect(html).toContain('/scenes/home-career-forward-portrait.jpg');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('No real clinician, patient, employer, credential, or outcome is represented.');
  });

  it('the explore documentary frame is a separately budgeted manifest asset', () => {
    const html = renderToStaticMarkup(
      <VisualScene
        scene="journey_film"
        kind="process"
        routeVariant="explore_documentary"
        priority="hero"
      />,
    );
    expect(html).toContain('data-scene-variant="explore_documentary"');
    expect(html).toContain('aspect-ratio:16 / 9');
    expect(html).toContain('/scenes/explore-clinician-horizon.jpg');
    expect(html).not.toContain('/scenes/home-career-forward-portrait.jpg');
    expect(html).toContain('No real clinician, patient, employer, credential, or outcome is represented.');
  });

  it('the employer page owns truthful documentary and tactile review scenes', () => {
    const documentary = renderToStaticMarkup(
      <VisualScene
        scene="journey_film"
        kind="process"
        routeVariant="employers_documentary"
      />,
    );
    expect(documentary).toContain('data-scene-variant="employers_documentary"');
    expect(documentary).toContain('/scenes/employers-care-team.webp');
    expect(documentary).toContain('clinical operations team reviewing a paper folder');
    expect(documentary).toContain('No real clinician, patient, employer, credential, packet result, or outcome is represented.');

    const desk = renderToStaticMarkup(
      <VisualScene scene="employer_desk" kind="process" priority="hero" />,
    );
    expect(desk).toContain('/scenes/employer-review-desk.webp');
    expect(desk).toContain('inspect, clarify, and institution-review actions');
    expect(desk).toContain('The illustration stops before any decision, credentialing action, hire, or start.');
  });

  it('a decorative scene is aria-hidden with empty alt', () => {
    const html = renderToStaticMarkup(<VisualScene scene="continuity_ribbon" kind="decorative" />);
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('data-scene-transcript');
  });

  it('a stateful scene renders its real state as words, including the unhappy paths', () => {
    for (const status of ['ready', 'unknown', 'unavailable', 'error'] as const) {
      const html = renderToStaticMarkup(
        <VisualScene
          scene="quiet_source_constellation"
          kind="stateful"
          state={{ status, caption: status === 'ready' ? 'read moments ago' : undefined }}
        />,
      );
      expect(html).toContain(`data-scene-state="${status}"`);
    }
    const unavailable = renderToStaticMarkup(
      <VisualScene scene="quiet_source_constellation" kind="stateful" state={{ status: 'unavailable' }} />,
    );
    expect(unavailable).toContain('Temporarily unavailable');
    // The unavailable state is a deliberate composition, not an empty scene.
    expect(unavailable).toContain('/scenes/quiet-source-constellation-placeholder.svg');
  });

  it('an unknown scene id renders nothing rather than a broken frame', () => {
    // Cast past the type gate deliberately — the runtime guard is the last line.
    const html = renderToStaticMarkup(
      <VisualScene scene={'not_a_scene' as never} kind="decorative" />,
    );
    expect(html).toBe('');
  });
});

describe('type-level contract (EC-26)', () => {
  it('stateful requires state; decorative and process forbid it', () => {
    // @ts-expect-error — stateful without state must not compile
    const missing = <VisualScene scene="quiet_source_constellation" kind="stateful" />;
    // @ts-expect-error — decorative with state must not compile
    const extra = <VisualScene scene="continuity_ribbon" kind="decorative" state={{ status: 'ready' }} />;
    expect(Boolean(missing) && Boolean(extra)).toBe(true);
  });
});

describe('motion discipline without motion assets', () => {
  it('no manifest entry ships motion in this wave, so no path can autoplay', () => {
    for (const entry of SCENE_MANIFEST) {
      expect(entry.motion).toEqual([]);
    }
  });
});

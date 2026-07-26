// @vitest-environment jsdom
/**
 * scene-runtime.test.tsx — SHD-1.1 scene runtime contracts.
 *
 * Pins the graceful-degradation ladder: SSR resolves static; reduced motion /
 * Save-Data / missing canvas resolve static (no render loop); the debug
 * override works only where allowed; SceneBoundary always renders the poster,
 * never mounts a scene at static tier, and swallows a scene crash into the
 * poster fallback instead of a blank or error region.
 */
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import {
  resolveTier,
  STATIC_CAPABILITIES,
  readForcedTier,
  type SceneCapabilities,
} from '@/components/home/scene/capabilities';
import { SceneBoundary } from '@/components/home/scene/SceneBoundary';

const caps = (over: Partial<SceneCapabilities>): SceneCapabilities => ({
  ...STATIC_CAPABILITIES,
  canvas2d: true,
  ...over,
});

describe('resolveTier ladder', () => {
  it('SSR snapshot (no probes) is static', () => {
    expect(resolveTier(STATIC_CAPABILITIES)).toBe('static');
  });

  it('reduced motion always wins: static, even with full GPU support', () => {
    expect(resolveTier(caps({ reducedMotion: true, webgl: true, webgpu: true }))).toBe('static');
  });

  it('Save-Data resolves static', () => {
    expect(resolveTier(caps({ saveData: true, webgpu: true }))).toBe('static');
  });

  it('no 2D context resolves static — never a degraded animation', () => {
    expect(resolveTier(caps({ canvas2d: false, webgpu: true }))).toBe('static');
  });

  it('canvas-only devices get canvas2d; WebGPU API presence grants webgpu', () => {
    expect(resolveTier(caps({}))).toBe('canvas2d');
    expect(resolveTier(caps({ webgpu: true }))).toBe('webgpu');
  });

  it('a forced tier (debug hook) overrides detection', () => {
    expect(resolveTier(caps({ webgpu: true, forcedTier: 'static' }))).toBe('static');
    expect(resolveTier(caps({ canvas2d: false, forcedTier: 'canvas2d' }))).toBe('canvas2d');
  });
});

describe('readForcedTier debug hook', () => {
  it('reads a valid tier from the window global and rejects junk', () => {
    const win = {
      location: { search: '' },
    } as unknown as Window;
    (win as Window & { __VCV_SCENE_TIER__?: string }).__VCV_SCENE_TIER__ = 'static';
    expect(readForcedTier(win)).toBe('static');
    (win as Window & { __VCV_SCENE_TIER__?: string }).__VCV_SCENE_TIER__ = 'sparkles';
    expect(readForcedTier(win)).toBeNull();
  });

  it('reads ?sceneTier= from the query string', () => {
    const win = { location: { search: '?sceneTier=canvas2d' } } as unknown as Window;
    expect(readForcedTier(win)).toBe('canvas2d');
  });
});

describe('SceneBoundary', () => {
  it('SSR renders the poster and no scene (static tier before hydration)', () => {
    const html = renderToStaticMarkup(
      <SceneBoundary poster={<svg data-poster="" />}>
        {() => <canvas data-live-scene="" />}
      </SceneBoundary>,
    );
    expect(html).toContain('data-poster');
    expect(html).toContain('data-scene-tier="static"');
    expect(html).not.toContain('data-live-scene');
  });

  it('a crashing scene falls back to the poster, records data-scene-error, and never surfaces the error', async () => {
    // jsdom detects canvas2d=false (no canvas package) → tier static; force
    // a live tier through the debug hook so the scene mounts, then crashes.
    (window as Window & { __VCV_SCENE_TIER__?: string }).__VCV_SCENE_TIER__ = 'canvas2d';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bomb = () => {
      throw new Error('scene exploded');
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <SceneBoundary poster={<svg data-poster="" />}>{() => <Bomb />}</SceneBoundary>,
      );
    });

    const boundary = host.querySelector('[data-scene-boundary]');
    expect(boundary?.hasAttribute('data-scene-error')).toBe(true);
    expect(boundary?.getAttribute('data-scene-tier')).toBe('static');
    expect(host.querySelector('[data-poster]')).not.toBeNull();
    expect(host.textContent).not.toContain('scene exploded');

    consoleError.mockRestore();
    delete (window as Window & { __VCV_SCENE_TIER__?: string }).__VCV_SCENE_TIER__;
    await act(async () => root.unmount());
    host.remove();
  });
});

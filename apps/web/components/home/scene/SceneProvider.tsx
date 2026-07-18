'use client';

/**
 * SceneProvider (SHD-1.1) — owns the capability snapshot and manual pause
 * state for every homepage scene.
 *
 * SSR and first paint always resolve to the 'static' tier, so semantic
 * content and posters render before any client scene hydrates. After mount,
 * capabilities are detected once and re-evaluated when the reduced-motion or
 * pointer media queries flip.
 *
 * Consumers may render WITHOUT a provider: useSceneTier() falls back to a
 * local one-shot detection so a stray consumer degrades gracefully instead of
 * crashing or over-animating.
 */

import * as React from 'react';

import {
  detectCapabilities,
  resolveTier,
  STATIC_CAPABILITIES,
  type SceneCapabilities,
  type SceneTier,
} from './capabilities';

interface SceneContextValue {
  capabilities: SceneCapabilities;
  tier: SceneTier;
  /** false until the post-mount detection ran (i.e. SSR/first paint). */
  ready: boolean;
  /** Manual pause: a user control may halt all scene animation. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

const SceneContext = React.createContext<SceneContextValue | null>(null);

function useDetectedCapabilities(): { capabilities: SceneCapabilities; ready: boolean } {
  const [state, setState] = React.useState<{ capabilities: SceneCapabilities; ready: boolean }>({
    capabilities: STATIC_CAPABILITIES,
    ready: false,
  });

  React.useEffect(() => {
    const refresh = () =>
      setState({ capabilities: detectCapabilities(window), ready: true });
    refresh();

    // Live media conditions can change (OS toggle, input change); re-resolve.
    // matchMedia itself is feature-detected — environments without it (old
    // browsers, bare jsdom) simply skip live re-resolution.
    if (typeof window.matchMedia !== 'function') return;
    const queries = ['(prefers-reduced-motion: reduce)', '(pointer: coarse)'].map((q) =>
      window.matchMedia(q),
    );
    queries.forEach((mq) => mq.addEventListener?.('change', refresh));
    return () => queries.forEach((mq) => mq.removeEventListener?.('change', refresh));
  }, []);

  return state;
}

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const { capabilities, ready } = useDetectedCapabilities();
  const [paused, setPaused] = React.useState(false);

  const value = React.useMemo<SceneContextValue>(
    () => ({
      capabilities,
      tier: paused ? 'static' : resolveTier(capabilities),
      ready,
      paused,
      setPaused,
    }),
    [capabilities, ready, paused],
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

/** Full scene context; providerless consumers get a local detection. */
export function useScene(): SceneContextValue {
  const fromProvider = React.useContext(SceneContext);
  const local = useDetectedCapabilities();
  const [localPaused, setLocalPaused] = React.useState(false);
  if (fromProvider) return fromProvider;
  return {
    capabilities: local.capabilities,
    tier: localPaused ? 'static' : resolveTier(local.capabilities),
    ready: local.ready,
    paused: localPaused,
    setPaused: setLocalPaused,
  };
}

/** The one question most scenes ask: how rich may I render right now? */
export function useSceneTier(): SceneTier {
  return useScene().tier;
}

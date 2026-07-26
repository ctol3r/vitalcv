/**
 * Scene capability detection + tier resolution (SHD-1.1).
 *
 * One place decides how rich a homepage scene may render. Every scene consumer
 * (evidence field today; rail chapters and the WebGPU field later) asks for a
 * tier instead of sniffing the environment itself, so degradation stays
 * consistent and testable.
 *
 * Tier ladder — richest tier the device SAFELY supports:
 *   'static'   → SSR poster only; no render loop at all.
 *   'canvas2d' → deterministic 2D canvas animation.
 *   'webgpu'   → optional GPU renderer (only when init succeeds quickly;
 *                consumers must still fall back to canvas2d/static on failure).
 *
 * Pure functions; no listeners here. SceneProvider owns subscriptions.
 */

export type SceneTier = 'static' | 'canvas2d' | 'webgpu';

export interface SceneCapabilities {
  reducedMotion: boolean;
  coarsePointer: boolean;
  canvas2d: boolean;
  webgl: boolean;
  webgpu: boolean;
  /** Save-Data request header surfaced via connection API, when available. */
  saveData: boolean;
  /** Debug override (dev/test only) — see readForcedTier. */
  forcedTier: SceneTier | null;
}

/** SSR / pre-hydration snapshot: nothing animates until proven safe. */
export const STATIC_CAPABILITIES: SceneCapabilities = {
  reducedMotion: false,
  coarsePointer: false,
  canvas2d: false,
  webgl: false,
  webgpu: false,
  saveData: false,
  forcedTier: null,
};

/**
 * Test/dev-only tier override so browser tests can force every fallback
 * without fighting real device capabilities (tasklist SHD-1.1.5). Reads
 * `?sceneTier=` or `window.__VCV_SCENE_TIER__`. Never honored in production
 * builds unless NEXT_PUBLIC_SCENE_DEBUG=1 is set for a test deployment.
 */
export function readForcedTier(win: Window): SceneTier | null {
  const debugAllowed =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SCENE_DEBUG === '1';
  if (!debugAllowed) return null;
  const fromGlobal = (win as Window & { __VCV_SCENE_TIER__?: unknown }).__VCV_SCENE_TIER__;
  const fromQuery = new URLSearchParams(win.location.search).get('sceneTier');
  const candidate = (typeof fromGlobal === 'string' ? fromGlobal : fromQuery) ?? null;
  return candidate === 'static' || candidate === 'canvas2d' || candidate === 'webgpu'
    ? candidate
    : null;
}

/** Cheap, throwaway-probe feature detection. Safe to call only in the browser. */
export function detectCapabilities(win: Window): SceneCapabilities {
  const media = (q: string) => {
    try {
      return win.matchMedia(q).matches;
    } catch {
      return false;
    }
  };

  let canvas2d = false;
  let webgl = false;
  try {
    const probe = win.document.createElement('canvas');
    canvas2d = Boolean(probe.getContext('2d'));
    // Separate probe canvas: some browsers refuse a second context kind on
    // the same element. A failed WebGL probe must never throw.
    const glProbe = win.document.createElement('canvas');
    webgl = Boolean(glProbe.getContext('webgl2') ?? glProbe.getContext('webgl'));
  } catch {
    /* leave probes false — static tier */
  }

  const connection = (win.navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;

  return {
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    coarsePointer: media('(pointer: coarse)'),
    canvas2d,
    webgl,
    webgpu: 'gpu' in win.navigator,
    saveData: Boolean(connection?.saveData),
    forcedTier: readForcedTier(win),
  };
}

/**
 * Resolve the richest tier the capability snapshot permits.
 * Reduced motion, Save-Data, and a missing 2D context all mean the designed
 * static poster — never a degraded animation and never a blank region.
 */
export function resolveTier(caps: SceneCapabilities): SceneTier {
  if (caps.forcedTier) return caps.forcedTier;
  if (caps.reducedMotion || caps.saveData || !caps.canvas2d) return 'static';
  // WebGPU is opt-in per consumer; resolving it here only says the API exists.
  if (caps.webgpu) return 'webgpu';
  return 'canvas2d';
}

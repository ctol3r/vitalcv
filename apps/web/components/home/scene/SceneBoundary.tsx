'use client';

/**
 * SceneBoundary (SHD-1.1) — the reusable shader/canvas scene wrapper.
 *
 * Contract (tasklist SHD-1.1.2/1.1.3):
 *  - The `poster` renders ALWAYS — server, first paint, static tier, and after
 *    any scene crash. A scene can only ever add on top of designed content;
 *    it can never leave a blank or black region behind.
 *  - `children(tier)` (the live scene) mounts only when the resolved tier
 *    allows animation. Under 'static' it is never mounted, so reduced motion
 *    runs no render loop at all.
 *  - A render/lifecycle error inside the scene is caught here: the scene
 *    unmounts, the poster stays, and the failure is recorded on a data
 *    attribute for tests — never shown to the user.
 */

import * as React from 'react';

import { useSceneTier } from './SceneProvider';
import type { SceneTier } from './capabilities';

interface SceneErrorBoundaryProps {
  onError?: (error: unknown) => void;
  children: React.ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

class SceneErrorBoundary extends React.Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface SceneBoundaryProps {
  /** Designed static layer — always rendered, never conditional. */
  poster: React.ReactNode;
  /** Live scene for the granted tier; not mounted under 'static'. */
  children: (tier: Exclude<SceneTier, 'static'>) => React.ReactNode;
  className?: string;
}

export function SceneBoundary({ poster, children, className }: SceneBoundaryProps) {
  const tier = useSceneTier();
  const [failed, setFailed] = React.useState(false);
  const live = tier !== 'static' && !failed;

  return (
    <div
      data-scene-boundary=""
      data-scene-tier={failed ? 'static' : tier}
      {...(failed ? { 'data-scene-error': '' } : {})}
      className={className}
    >
      {poster}
      {live ? (
        <SceneErrorBoundary onError={() => setFailed(true)}>
          {children(tier)}
        </SceneErrorBoundary>
      ) : null}
    </div>
  );
}

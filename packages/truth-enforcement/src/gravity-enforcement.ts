import { EnforcementViolation } from './index';

export interface GravityUIRenderState {
  hasStagedRendering: boolean;
  hasPartialManifest: boolean;
  hasDelayedTruth: boolean;
  hasPostRenderMutation: boolean;
}

/**
 * Validates frontend render state against the Gravity Engine Canon.
 * Fails closed on any violation of atomic, instant truth rendering.
 */
export function guardGravityEngineCanon(state: GravityUIRenderState): void {
  if (state.hasStagedRendering) {
    throw new EnforcementViolation(
      'UI', 
      'U1_STAGED_RENDERING', 
      'UI attempted to stage or incrementally render truth data.', 
      'CRITICAL'
    );
  }
  
  if (state.hasPartialManifest) {
    throw new EnforcementViolation(
      'UI', 
      'U2_PARTIAL_MANIFEST', 
      'UI attempted to display an incomplete manifest before atomic resolution.', 
      'CRITICAL'
    );
  }
  
  if (state.hasDelayedTruth) {
    throw new EnforcementViolation(
      'UI', 
      'U3_DELAYED_TRUTH', 
      'UI artificially delayed rendering already-computed truth data.', 
      'CRITICAL'
    );
  }

  if (state.hasPostRenderMutation) {
    throw new EnforcementViolation(
      'UI', 
      'U4_POST_RENDER_MUTATION', 
      'UI mutated or incrementally fetched truth data after the initial render.', 
      'CRITICAL'
    );
  }
}

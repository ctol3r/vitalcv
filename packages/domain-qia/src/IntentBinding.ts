/**
 * Intent binding: explicit purpose, scope, expiry, audience, constraints.
 */

import type { EvidenceRef, SignatureEnvelope } from './types';

export interface IntentBinding {
  readonly intent_id: string;
  readonly purpose: string;
  readonly scope: readonly string[];
  readonly audience: readonly string[];
  readonly constraints?: Record<string, unknown>;
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly evidence_refs?: readonly EvidenceRef[];
  readonly signature?: SignatureEnvelope;
}

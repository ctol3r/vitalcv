/**
 * activationHeaderStage — which journey stage the activation surface may
 * declare to the shared header, per flow phase.
 *
 * The rail reflects server-backed progression only. `success` is entered
 * after `/api/profile/npi/bootstrap` returns a resolved NPPES record — a
 * real server confirmation — so it advances the narrative to Sources.
 * Every other phase, including the student preview lane (which resolves no
 * NPI and therefore no sources), stays at Your Number. No client-invented
 * completion state may ever advance this.
 */

import type { JourneyStageId } from '@/components/layout/journeyStages';

export function activationHeaderStage(phase: string): JourneyStageId {
  return phase === 'success' ? 'sources' : 'your-number';
}

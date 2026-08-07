/**
 * The homepage's source-freshness statement, in one sentence.
 *
 * DERIVED from `sourceLanes.ts` — the same registry behind /status and
 * /api/status — so a lane's cadence cannot drift from what the homepage says
 * about it. This is why the sentence never says "live" as a blanket: one lane
 * is read per request and three are not. (#822/#817/#824 found the homepage
 * badging OIG and PECOS as "read live" while /api/status disagreed.)
 *
 * Extracted from HorizontalCareerFilm in Wave 1075. It lived inside the film
 * component, so the one sentence that keeps the homepage from overclaiming
 * freshness would have been deleted along with the film. Both the career-loop
 * homepage and the film rollback now render the same derivation.
 */

import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

export function sourceCadenceSentence(): string {
  const label = (id: string) =>
    SOURCE_LANE_OPS.find((lane) => lane.laneId === id)?.cadenceLabel ?? 'not read';
  return (
    `NPPES is ${label('nppes_identity')} per request; ` +
    `OIG/LEIE returns a ${label('oig_exclusions')} and CMS PECOS a ${label('pecos_enrollment')}; ` +
    `state licensure is ${label('state_license')}.`
  );
}

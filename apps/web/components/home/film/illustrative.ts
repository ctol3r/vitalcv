/**
 * The illustrative record.
 *
 * Chapters 2–4 explain what happens AFTER a lookup, which cannot be shown with
 * a real person's evidence and must not be shown with an invented one dressed
 * as real. So this is one clearly-labelled worked example, and every surface
 * that renders it also renders the words "Illustrative — not a live result".
 *
 * THE RULES THIS FILE OBEYS, which are not stylistic:
 *
 *  1. **No NPI.** Not a real one, not a synthetic one, not a check-digit-valid
 *     placeholder. Only a masked tail (`NPI ····· 4821`), because a well-formed
 *     NPI in marketing copy is indistinguishable from a claim about whoever
 *     actually holds it — and this repository has already shipped seeded
 *     profiles squatting real NPIs once.
 *  2. **The states are the product's real states**, from the same canonical
 *     vocabulary the live capsule uses, including the two that are inconvenient:
 *     licensure is `accessRequired` because VitalCV genuinely cannot read state
 *     boards yet, and it is shown as exactly that rather than quietly omitted.
 *  3. **Cadence comes from the registry**, never typed here — so an illustrative
 *     row cannot claim a freshness the real lane does not have.
 */

import type { EvidenceCapsuleModel, EvidenceRow } from '@/components/home/evidence/evidenceCapsuleModel';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/** The label that must accompany every illustrative surface. */
export const ILLUSTRATIVE_LABEL = 'Illustrative — not a live result';

/** The label for surfaces showing a workflow rather than a source result. */
export const ILLUSTRATIVE_WORKFLOW = 'Illustrative workflow';

const cadence = (laneId: string) =>
  SOURCE_LANE_OPS.find((lane) => lane.laneId === laneId)?.cadenceLabel ?? null;
const sourceName = (laneId: string) =>
  SOURCE_LANE_OPS.find((lane) => lane.laneId === laneId)?.marketingShortName ?? null;

/**
 * The six lanes in their pre-lookup state — which is the literal truth for a
 * visitor who has entered nothing, and therefore the one "result" the homepage
 * may show without a lookup and without a label.
 */
export const AWAITING_ROWS: ReadonlyArray<{
  id: string;
  claim: string;
  meta: string;
  state: 'pending' | 'accessRequired';
  stateLabel: string;
}> = Object.freeze([
  {
    id: 'nppes_identity',
    claim: 'NPPES Identity',
    meta: `${sourceName('nppes_identity') ?? 'CMS Registry'} · ${cadence('nppes_identity') ?? ''}`,
    state: 'pending',
    stateLabel: 'Not checked',
  },
  {
    id: 'oig_exclusions',
    claim: 'OIG Exclusions',
    meta: `${sourceName('oig_exclusions') ?? 'OIG LEIE'} · ${cadence('oig_exclusions') ?? ''}`,
    state: 'pending',
    stateLabel: 'Not checked',
  },
  {
    id: 'state_license',
    claim: 'State License',
    meta: `${sourceName('state_license') ?? 'State Medical Board'} · ${cadence('state_license') ?? ''}`,
    state: 'accessRequired',
    stateLabel: 'Access required',
  },
  {
    id: 'pecos_enrollment',
    claim: 'PECOS Enrollment',
    meta: `${sourceName('pecos_enrollment') ?? 'CMS PECOS'} · ${cadence('pecos_enrollment') ?? ''}`,
    state: 'pending',
    stateLabel: 'Not checked',
  },
  {
    id: 'employment_history',
    claim: 'Employment History',
    meta: `${sourceName('employment_history') ?? 'The Work Number'} · ${cadence('employment_history') ?? ''}`,
    state: 'accessRequired',
    stateLabel: 'Access required',
  },
  {
    id: 'board_cert',
    claim: 'Board Certification',
    meta: `${sourceName('board_cert') ?? 'ABMS / Specialty Board'} · ${cadence('board_cert') ?? ''}`,
    state: 'accessRequired',
    stateLabel: 'Access required',
  },
]);

const row = (r: EvidenceRow): EvidenceRow => r;

/** The worked example, in the same shape the live lookup produces. */
export const ILLUSTRATIVE_MODEL: EvidenceCapsuleModel = Object.freeze({
  npi: '····· 4821',
  identity: Object.freeze({
    name: 'K. Osei, PA-C',
    detail: 'Physician Assistant · Illustrative',
    fromRegistry: true,
  }),
  rows: Object.freeze([
    row({
      id: 'identity',
      claim: 'Identity',
      source: sourceName('nppes_identity'),
      returned: 'Located in the NPPES registry',
      cadence: cadence('nppes_identity'),
      limitation: 'The registry lists the provider record. It does not attest to current practice.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    }),
    row({
      id: 'oig',
      claim: 'OIG exclusions',
      source: sourceName('oig_exclusions'),
      returned: 'No match in the current LEIE file',
      cadence: cadence('oig_exclusions'),
      limitation: 'A monthly file cannot show an exclusion published after it was compiled.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    }),
    row({
      id: 'pecos',
      claim: 'Medicare enrollment (PECOS)',
      source: sourceName('pecos_enrollment'),
      returned: 'An active enrollment was returned',
      cadence: cadence('pecos_enrollment'),
      limitation: 'A quarterly snapshot can lag a recent enrollment change.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    }),
    row({
      id: 'licensure',
      claim: 'State licensure',
      source: sourceName('state_license'),
      returned: 'Not read — state-board access required',
      cadence: cadence('state_license'),
      limitation: 'VitalCV has no board or FSMB access for this lane yet.',
      observedAt: null,
      kind: 'unavailable',
      state: 'accessRequired',
    }),
  ]) as EvidenceRow[],
  nextAction: null,
  empty: false,
}) as EvidenceCapsuleModel;

/**
 * The travel decisions. Three claims move with an application, two stay with
 * the clinician — and the held ones are ABSENT from what the employer receives
 * rather than greyed out there, because that is what actually happens.
 */
export const TRAVEL_LEDGER: ReadonlyArray<{
  id: string;
  claim: string;
  detail: string;
  travels: boolean;
}> = Object.freeze([
  {
    id: 'identity',
    claim: 'Identity & taxonomy',
    detail: 'from NPPES Identity',
    travels: true,
  },
  {
    id: 'exclusion',
    claim: 'Federal exclusion result',
    detail: 'from OIG LEIE',
    travels: true,
  },
  {
    id: 'licensure',
    claim: 'License claim',
    detail: 'travels as exactly what it is — not read',
    travels: true,
  },
  {
    id: 'compensation',
    claim: 'Compensation expectations',
    detail: 'entered by the clinician · never sourced',
    travels: false,
  },
  {
    id: 'employer',
    claim: 'Current employer standing',
    detail: 'not queried',
    travels: false,
  },
]);

/** The signing facts. Real, published, and checkable without trusting VitalCV. */
export const SIGNING = Object.freeze({
  algorithm: 'ES256 · P-256',
  keyId: 'vcv-es256-prod-1',
  keyPath: '/.well-known/jwks.json',
});

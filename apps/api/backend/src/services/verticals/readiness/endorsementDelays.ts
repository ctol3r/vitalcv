/**
 * Wave 210 — Endorsement Delays Database
 */
export interface EndorsementDelay { state: string; profession: string; typicalDaysMin: number; typicalDaysMax: number; requiresNlcCompact: boolean; requiresCounselingCompact: boolean; notes: string }

export const ENDORSEMENT_DELAYS: EndorsementDelay[] = [
  { state: 'CA', profession: 'RN',   typicalDaysMin: 60,  typicalDaysMax: 120, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'BRN endorsement; fingerprint required' },
  { state: 'CA', profession: 'LCSW', typicalDaysMin: 90,  typicalDaysMax: 150, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'BBS; verification letter from original board required' },
  { state: 'TX', profession: 'RN',   typicalDaysMin: 30,  typicalDaysMax:  60, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact member — privilege within days' },
  { state: 'TX', profession: 'LPC',  typicalDaysMin: 45,  typicalDaysMax:  90, requiresNlcCompact: false, requiresCounselingCompact: true,  notes: 'Counseling Compact member' },
  { state: 'NY', profession: 'RN',   typicalDaysMin: 60,  typicalDaysMax:  90, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'NYS DOH endorsement; not NLC compact' },
  { state: 'FL', profession: 'RN',   typicalDaysMin: 14,  typicalDaysMax:  30, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact; fast processing' },
  { state: 'WA', profession: 'RN',   typicalDaysMin: 21,  typicalDaysMax:  45, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact member' },
  { state: 'OR', profession: 'RN',   typicalDaysMin: 30,  typicalDaysMax:  60, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact member' },
  { state: 'AZ', profession: 'RN',   typicalDaysMin:  7,  typicalDaysMax:  21, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact; expedited available' },
  { state: 'CO', profession: 'RN',   typicalDaysMin: 14,  typicalDaysMax:  30, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact member' },
  { state: 'IL', profession: 'RN',   typicalDaysMin: 45,  typicalDaysMax:  90, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'IDFPR endorsement; not NLC compact' },
  { state: 'GA', profession: 'RN',   typicalDaysMin: 14,  typicalDaysMax:  30, requiresNlcCompact: true,  requiresCounselingCompact: false, notes: 'NLC compact member' },
  { state: 'WA', profession: 'LCSW', typicalDaysMin: 60,  typicalDaysMax: 120, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'DOH; written verification from original board' },
  { state: 'NY', profession: 'LMFT', typicalDaysMin: 90,  typicalDaysMax: 180, requiresNlcCompact: false, requiresCounselingCompact: false, notes: 'NYSED; lengthy review' },
];

export const NLC_COMPACT_STATES = ['AL','AZ','AR','CO','DE','FL','GA','ID','IN','IA','KS','KY','LA','ME','MD','MS','MO','MT','NE','NH','NM','NC','ND','OK','OR','SC','SD','TN','TX','UT','VA','WA','WV','WI','WY'];
export const COUNSELING_COMPACT_STATES = ['AL','CO','DE','FL','GA','ID','IN','KS','KY','LA','ME','MD','MS','MO','MT','NE','NH','NC','ND','OH','OK','OR','PA','SC','SD','TN','TX','UT','VA','WA','WV','WI'];

export function getEndorsementDelay(state: string, profession: string): EndorsementDelay | undefined {
  return ENDORSEMENT_DELAYS.find((d) => d.state === state && d.profession === profession);
}

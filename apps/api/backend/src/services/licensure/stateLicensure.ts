/**
 * stateLicensure.ts — Wave 65: State Licensure & IMLC Tracker
 *
 * Computes eligible states, IMLC eligibility, and reciprocity rules.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface StateEligibility {
  state: string;
  reason: string;
  pathway: 'imlc' | 'reciprocity' | 'endorsement';
  applicationUrl?: string;
}

// ── IMLC Member States ────────────────────────────────────────────────────

const IMLC_STATES = new Set([
  'AL', 'AZ', 'CO', 'DC', 'GA', 'IA', 'ID', 'IL', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'NV',
  'ND', 'OH', 'OK', 'PA', 'SD', 'TN', 'TX', 'UT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]);

// ── Reciprocity Groups (simplified) ───────────────────────────────────────

const RECIPROCITY_GROUPS: string[][] = [
  ['CA', 'OR', 'WA'],
  ['NY', 'NJ', 'CT', 'PA'],
  ['TX', 'OK', 'AR', 'LA'],
  ['FL', 'GA', 'SC', 'NC'],
  ['AZ', 'NV', 'UT', 'CO', 'NM'],
  ['IL', 'IN', 'OH', 'MI', 'WI'],
];

// ── Application URLs (stub) ──────────────────────────────────────────────

const STATE_APP_URLS: Record<string, string> = {
  AZ: 'https://azmd.gov/apply',
  NV: 'https://medboard.nv.gov/apply',
  UT: 'https://dopl.utah.gov/med/apply',
  CO: 'https://dora.colorado.gov/med',
  TX: 'https://tmb.state.tx.us/apply',
  FL: 'https://flboardofmedicine.gov/apply',
  NY: 'https://op.nysed.gov/apply',
  CA: 'https://mbc.ca.gov/apply',
  // TODO: Add remaining state application URLs
};

// ── Engine ────────────────────────────────────────────────────────────────

export function getEligibleStates(currentStates: string[]): StateEligibility[] {
  const current = new Set(currentStates.map((s) => s.toUpperCase()));
  const eligible: StateEligibility[] = [];
  const seen = new Set<string>();

  // IMLC eligibility: if any current state is IMLC member, all IMLC states are available
  const hasImlcState = [...current].some((s) => IMLC_STATES.has(s));
  if (hasImlcState) {
    for (const state of IMLC_STATES) {
      if (!current.has(state) && !seen.has(state)) {
        seen.add(state);
        eligible.push({
          state,
          reason: `IMLC compact — expedited licensure from your ${[...current].find((s) => IMLC_STATES.has(s))} license`,
          pathway: 'imlc',
          applicationUrl: STATE_APP_URLS[state],
        });
      }
    }
  }

  // Reciprocity: states in same group as current licenses
  for (const group of RECIPROCITY_GROUPS) {
    const hasGroupState = group.some((s) => current.has(s));
    if (hasGroupState) {
      for (const state of group) {
        if (!current.has(state) && !seen.has(state)) {
          seen.add(state);
          eligible.push({
            state,
            reason: `Reciprocity agreement — streamlined application from neighboring state`,
            pathway: 'reciprocity',
            applicationUrl: STATE_APP_URLS[state],
          });
        }
      }
    }
  }

  // Sort: IMLC first, then alphabetical
  eligible.sort((a, b) => {
    if (a.pathway !== b.pathway) return a.pathway === 'imlc' ? -1 : 1;
    return a.state.localeCompare(b.state);
  });

  return eligible;
}

export function checkImlcEligibility(homeState: string): boolean {
  return IMLC_STATES.has(homeState.toUpperCase());
}

export function getImlcStates(): string[] {
  return [...IMLC_STATES].sort();
}

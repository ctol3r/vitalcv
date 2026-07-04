/**
 * Livability lookups — honest relocation context for an opportunity.
 *
 * Truth rule: VitalCV does NOT fabricate cost-of-living, weather, walk-score, or school figures.
 * Instead, each category links out to a real external lookup scoped to the opportunity's location.
 * The UI states plainly that these are external sources, not VitalCV estimates. When the role is
 * remote, relocation context is not asserted at all.
 */

export interface LivabilityCategory {
  key: string;
  label: string;
  /** What the external lookup covers. */
  hint: string;
}

export const LIVABILITY_CATEGORIES: readonly LivabilityCategory[] = [
  { key: 'cost_of_living', label: 'Cost of living', hint: 'Overall affordability index' },
  { key: 'housing', label: 'Housing', hint: 'Home prices & rent' },
  { key: 'schools', label: 'Schools', hint: 'Ratings & districts' },
  { key: 'commute', label: 'Commute', hint: 'Transit & drive times' },
  { key: 'safety', label: 'Safety', hint: 'Crime & safety data' },
  { key: 'weather', label: 'Weather', hint: 'Climate & seasons' },
  { key: 'things_to_do', label: 'Things to do', hint: 'Amenities & recreation' },
];

/** Build an honest external search URL for a category + location. */
export function livabilityLookupUrl(categoryKey: string, location: string): string {
  const cat = LIVABILITY_CATEGORIES.find((c) => c.key === categoryKey);
  const term = cat ? cat.label : '';
  const query = `${term} in ${location}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Compose a readable location string from opportunity fields. */
export function locationLabel(input: { location?: string; state?: string }): string | null {
  const loc = input.location?.trim();
  const st = input.state?.trim();
  if (loc && st) {
    // Don't append the state if the location already references it (e.g. "Oakland, CA" + "CA").
    const escaped = st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alreadyHasState = new RegExp(`\\b${escaped}\\b`, 'i').test(loc);
    return alreadyHasState ? loc : `${loc}, ${st}`;
  }
  return loc || st || null;
}

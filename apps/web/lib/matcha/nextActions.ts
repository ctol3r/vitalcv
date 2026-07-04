/**
 * "What to do next" — derives the clinician's most useful next steps from real MATCHA state.
 *
 * Pure and honest: every suggestion is grounded in an actual gap (no NPI, unreviewed matches,
 * a thin match-question category, a low overall completeness). If everything is in good shape,
 * it falls back to a single neutral suggestion rather than inventing urgency.
 */

import { CATEGORY_META, type MatchCategory } from './categories';

export interface NextActionInput {
  hasNpi: boolean;
  completeness: number;
  categories: Array<{ category: MatchCategory; answered: number; total: number; percent: number }>;
  newMatches: number;
  savedMatches: number;
}

export interface NextAction {
  id: string;
  label: string;
  href: string;
  primary: boolean;
}

const ASSESS = '/holder/matcha/assessment';
const OPPS = '/holder/matcha/opportunities';

export function deriveNextActions(input: NextActionInput): NextAction[] {
  const actions: NextAction[] = [];

  if (!input.hasNpi) {
    actions.push({ id: 'add-npi', label: 'Add your NPI to unlock matches', href: '/holder', primary: true });
  }

  if (input.newMatches > 0) {
    actions.push({
      id: 'review-matches',
      label: `Review ${input.newMatches} new match${input.newMatches === 1 ? '' : 'es'}`,
      href: OPPS,
      primary: true,
    });
  }

  if (input.completeness === 0) {
    actions.push({ id: 'meet-matcha', label: 'Answer your first match questions', href: '/holder/matcha/onboarding', primary: actions.length === 0 });
  } else {
    // Nudge the thinnest category first.
    const thinnest = [...input.categories]
      .filter((c) => c.percent < 100)
      .sort((a, b) => a.percent - b.percent)[0];
    if (thinnest) {
      actions.push({
        id: `answer-${thinnest.category}`,
        label: `Answer more ${CATEGORY_META[thinnest.category].label} questions`,
        href: ASSESS,
        primary: actions.length === 0,
      });
    }
  }

  if (input.savedMatches > 0) {
    actions.push({ id: 'revisit-saved', label: 'Revisit your saved opportunities', href: OPPS, primary: false });
  }

  if (input.completeness > 0 && input.completeness < 60) {
    actions.push({ id: 'sharpen', label: 'Sharpen your profile for better matches', href: ASSESS, primary: false });
  }

  // De-duplicate by href, keep first (highest priority), cap at 4.
  const seen = new Set<string>();
  const deduped = actions.filter((a) => {
    if (seen.has(a.href)) return false;
    seen.add(a.href);
    return true;
  });

  if (deduped.length === 0) {
    deduped.push({ id: 'browse', label: 'Browse your opportunities', href: OPPS, primary: true });
  }

  return deduped.slice(0, 4);
}

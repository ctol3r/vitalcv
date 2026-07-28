import type { CvEntry, GardenOpportunity } from './demoData';

/**
 * Deterministic cover-letter assembly for the Prepare flow. A pure template
 * over the facts the clinician selected — no AI call, no invention. Every
 * sentence beyond the selected facts is fixed connective copy, so the
 * "Facts used in this draft" panel accounts for all substantive content.
 */
export function buildCoverLetterDraft(
  opportunity: GardenOpportunity,
  selectedFacts: CvEntry[],
): string {
  const opening = `Dear hiring team at ${opportunity.org},\n\nI am writing about the ${opportunity.title.replace(' (sample posting)', '')} role.`;

  const factLines =
    selectedFacts.length > 0
      ? selectedFacts.map((f) => `• ${f.headline} — ${f.detail}`).join('\n')
      : '• (No facts selected yet — pick the lines you want this draft to rest on.)';

  const middle = `Here is the relevant record I would bring, exactly as it stands in my living CV:\n\n${factLines}`;

  const closing =
    'I would welcome a conversation about how this record fits your team.\n\nSincerely,\n[Your name]';

  return `${opening}\n\n${middle}\n\n${closing}`;
}

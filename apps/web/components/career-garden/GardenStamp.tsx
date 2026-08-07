import type { GardenProvenance } from '@/lib/career-garden/demoData';

/**
 * Workspace-provenance stamp for garden items, rendered with the existing
 * Calm Wave chip classes — this is a mapping onto `.mz-chip`, not a new
 * badge system. Evidence states on opportunity rows use the canonical
 * <StateChip /> instead; this stamp covers the workspace-only vocabulary
 * (drafts, connections, links, candidate matches).
 *
 * Word + glyph always travel together; the hue never carries the meaning.
 */
const STAMP: Record<GardenProvenance, { word: string; toneClass: string }> = {
  'self-attested': { word: 'Self-attested', toneClass: 'mz-chip-unknown' },
  'ai-assisted-draft': { word: 'AI-assisted draft', toneClass: 'mz-chip-watch' },
  'connected-profile': { word: 'Connected profile', toneClass: 'mz-chip-unknown' },
  'self-added-link': { word: 'Self-added link', toneClass: 'mz-chip-unknown' },
  'candidate-match': { word: 'Candidate match', toneClass: 'mz-chip-watch' },
  'not-connected': { word: 'Not connected', toneClass: 'mz-chip-unknown' },
};

export function GardenStamp({ provenance }: { provenance: GardenProvenance }) {
  const stamp = STAMP[provenance];
  return (
    <span className={`mz-chip ${stamp.toneClass}`}>
      <span className="mz-gl" aria-hidden="true" />
      {stamp.word}
    </span>
  );
}

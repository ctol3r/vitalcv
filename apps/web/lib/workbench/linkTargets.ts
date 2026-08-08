/**
 * Client-side registries for the typed link picker — CC-09 / WB-05.
 *
 * These mirror the backend's closed registries in
 * apps/api/backend/src/services/garden/gardenLinksService.ts, which remain
 * the single authority: the picker only *offers* these keys, and the backend
 * re-validates every one at create time and again at read time. A drifted
 * key here can never mint a link — it 404s at the source of truth.
 */

export const LINK_TARGET_TYPE_LABEL: Record<string, string> = {
  note: 'Note',
  cv_entry: 'Living CV line',
  profile_field: 'Profile field',
  source_pointer: 'Source pointer',
};

export const PROFILE_FIELD_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'preferred_location', label: 'Profile: Preferred location' },
  { key: 'schedule_preference', label: 'Profile: Schedule preference' },
  { key: 'specialty_focus', label: 'Profile: Specialty focus' },
  { key: 'licensure_plan', label: 'Profile: Licensure plan' },
  { key: 'compensation_floor', label: 'Profile: Compensation floor' },
];

export const SOURCE_POINTER_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'nppes', label: 'Source: NPPES record (research pointer)' },
  { key: 'oig_leie', label: 'Source: OIG LEIE check (research pointer)' },
  { key: 'pecos', label: 'Source: PECOS enrollment (research pointer)' },
  { key: 'state_board', label: 'Source: State licensing board (research pointer)' },
];

export interface PickerCandidate {
  targetType: string;
  targetId: string;
  label: string;
}

/**
 * Assemble picker candidates from the caller's own data plus the closed
 * registries, filtered by the text typed after `[[`. Opportunity targets are
 * deliberately absent until a search endpoint owns them (recorded product
 * dependency) — the backend already supports them.
 */
export function pickerCandidates(
  query: string,
  ownNotes: ReadonlyArray<{ id: string; title: string }>,
  ownCvEntries: ReadonlyArray<{ id: string; headline: string }>,
  excludeNoteId?: string,
): PickerCandidate[] {
  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);
  const out: PickerCandidate[] = [];
  for (const n of ownNotes) {
    if (n.id !== excludeNoteId && match(n.title)) {
      out.push({ targetType: 'note', targetId: n.id, label: n.title });
    }
  }
  for (const e of ownCvEntries) {
    if (match(e.headline)) out.push({ targetType: 'cv_entry', targetId: e.id, label: e.headline });
  }
  for (const f of PROFILE_FIELD_OPTIONS) {
    if (match(f.label)) out.push({ targetType: 'profile_field', targetId: f.key, label: f.label });
  }
  for (const s of SOURCE_POINTER_OPTIONS) {
    if (match(s.label)) out.push({ targetType: 'source_pointer', targetId: s.key, label: s.label });
  }
  return out.slice(0, 12);
}

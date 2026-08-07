import {
  CV_SECTION_LABEL,
  DEMO_CV_ENTRIES,
  DEMO_SEEDS,
  type CvSection,
} from './demoData';

/**
 * View shapes shared by the live (backend-persisted) and fixture (harness)
 * mounts of the Career Garden. Pure data + pure helpers, safe on both the
 * server and the client. Nothing here widens provenance: a garden CV view is
 * always self-attested.
 */

export type GardenDataMode = 'live' | 'fixture' | 'unavailable';

export interface GardenNoteView {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: 'unfiled' | 'growing' | 'grown';
  capturedAt: string; // YYYY-MM-DD
}

export interface GardenCvView {
  id: string;
  section: CvSection;
  headline: string;
  detail: string;
  provenance: 'self-attested';
  origin: string[];
  approvedAt: string; // YYYY-MM-DD
  fromNoteId?: string;
}

export interface GardenData {
  mode: GardenDataMode;
  notes: GardenNoteView[];
  cvEntries: GardenCvView[];
}

export const GARDEN_UNAVAILABLE: GardenData = { mode: 'unavailable', notes: [], cvEntries: [] };

/* ---------------------------- fixture mapping ---------------------------- */

export function fixtureGardenData(): GardenData {
  return {
    mode: 'fixture',
    notes: DEMO_SEEDS.map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      tags: s.tags,
      status: s.status,
      capturedAt: s.capturedAt,
    })),
    cvEntries: DEMO_CV_ENTRIES.map((e) => ({
      id: e.id,
      section: e.section,
      headline: e.headline,
      detail: e.detail,
      provenance: 'self-attested' as const,
      origin: e.origin,
      approvedAt: '2026-07-19',
    })),
  };
}

/** Fixture seeds carry an authored draft; live notes derive one. */
export function growPrefill(note: GardenNoteView): { section: CvSection | ''; headline: string; detail: string } {
  const fixture = DEMO_SEEDS.find((s) => s.id === note.id);
  if (fixture) return { ...fixture.growDraft };
  const firstSentence = note.body.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return {
    section: '',
    headline: note.title.slice(0, 120),
    detail: firstSentence.slice(0, 300),
  };
}

/* ------------------------------ derivations ------------------------------ */

export interface GardenActivityEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
}

export function deriveActivity(data: GardenData): GardenActivityEvent[] {
  const events: GardenActivityEvent[] = [];
  for (const note of data.notes) {
    events.push({
      id: `activity-note-${note.id}`,
      at: note.capturedAt,
      label: 'Seed planted',
      detail: `“${note.title}” captured as a private note.`,
    });
  }
  for (const entry of data.cvEntries) {
    events.push({
      id: `activity-entry-${entry.id}`,
      at: entry.approvedAt,
      label: 'Bloom approved',
      detail: `“${entry.headline}” joined your Living CV (${CV_SECTION_LABEL[entry.section]}), approved by you.`,
    });
  }
  return events
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 5);
}

export interface GardenTodayTask {
  id: string;
  label: string;
  detail: string;
  noteId?: string;
}

/** Deterministic, count-grounded Today panel for the live mount. */
export function deriveTodayTasks(data: GardenData): GardenTodayTask[] {
  const tasks: GardenTodayTask[] = [];
  const growing = data.notes.filter((n) => n.status === 'growing');
  const unfiled = data.notes.filter((n) => n.status === 'unfiled');
  if (growing.length > 0) {
    tasks.push({
      id: 'today-review-growing',
      label: `Review ${growing.length === 1 ? 'one growing seed' : `${growing.length} growing seeds`}`,
      detail: `“${growing[0].title}” has a CV draft waiting for your review.`,
      noteId: growing[0].id,
    });
  }
  if (unfiled.length > 0) {
    tasks.push({
      id: 'today-file-seeds',
      label: `Tend ${unfiled.length === 1 ? 'one unfiled seed' : `${unfiled.length} unfiled seeds`}`,
      detail: 'Read them again, tag them, or grow one into your CV.',
      noteId: unfiled[0].id,
    });
  }
  if (data.notes.length === 0) {
    tasks.push({
      id: 'today-first-seed',
      label: 'Plant your first seed',
      detail: 'Press ⌘K and choose Capture — a thought is enough.',
    });
  }
  return tasks.slice(0, 3);
}

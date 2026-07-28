import { describe, expect, it } from 'vitest';

import {
  deriveActivity,
  deriveTodayTasks,
  fixtureGardenData,
  growPrefill,
  type GardenData,
} from '@/lib/career-garden/gardenViews';

/**
 * The pure derivations behind the live garden: grow-prefill, the Today
 * panel, and the activity strip. All deterministic, all count-grounded.
 */

function liveData(partial?: Partial<GardenData>): GardenData {
  return {
    mode: 'live',
    notes: [],
    cvEntries: [],
    ...partial,
  };
}

describe('gardenViews', () => {
  it('fixture data carries only self-attested provenance', () => {
    const data = fixtureGardenData();
    expect(data.mode).toBe('fixture');
    expect(data.notes.length).toBeGreaterThan(0);
    for (const entry of data.cvEntries) {
      expect(entry.provenance).toBe('self-attested');
    }
  });

  it('growPrefill uses the authored draft for fixture seeds', () => {
    const data = fixtureGardenData();
    const seed = data.notes.find((n) => n.id === 'seed-journal-club')!;
    const prefill = growPrefill(seed);
    expect(prefill.section).toBe('service');
    expect(prefill.headline).toContain('48-hour');
  });

  it('growPrefill derives deterministically for live notes and forces a section choice', () => {
    const prefill = growPrefill({
      id: 'live-1',
      title: 'Taught intern splinting workshop',
      body: 'Ran a splinting session for interns. Went well. Should repeat quarterly.',
      tags: [],
      status: 'unfiled',
      capturedAt: '2026-07-27',
    });
    expect(prefill.section).toBe('');
    expect(prefill.headline).toBe('Taught intern splinting workshop');
    expect(prefill.detail).toBe('Ran a splinting session for interns.');
  });

  it('deriveTodayTasks grounds every task in real counts', () => {
    const tasks = deriveTodayTasks(
      liveData({
        notes: [
          { id: 'a', title: 'Growing one', body: '', tags: [], status: 'growing', capturedAt: '2026-07-20' },
          { id: 'b', title: 'Unfiled one', body: '', tags: [], status: 'unfiled', capturedAt: '2026-07-21' },
        ],
      }),
    );
    expect(tasks[0].label).toBe('Review one growing seed');
    expect(tasks[0].noteId).toBe('a');
    expect(tasks[1].label).toBe('Tend one unfiled seed');
  });

  it('deriveTodayTasks invites the first capture on an empty garden', () => {
    const tasks = deriveTodayTasks(liveData());
    expect(tasks).toHaveLength(1);
    expect(tasks[0].label).toBe('Plant your first seed');
  });

  it('deriveActivity interleaves captures and approvals newest-first', () => {
    const events = deriveActivity(
      liveData({
        notes: [{ id: 'a', title: 'Note', body: '', tags: [], status: 'grown', capturedAt: '2026-07-10' }],
        cvEntries: [
          {
            id: 'e1',
            section: 'teaching',
            headline: 'Line',
            detail: 'Detail',
            provenance: 'self-attested',
            origin: ['Grown from your note “Note”'],
            approvedAt: '2026-07-22',
            fromNoteId: 'a',
          },
        ],
      }),
    );
    expect(events[0].label).toBe('Bloom approved');
    expect(events[1].label).toBe('Seed planted');
  });
});

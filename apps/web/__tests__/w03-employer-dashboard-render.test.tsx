/**
 * W0.3 — the employer dashboard renders only what the database returned.
 *
 * The route it replaces rendered a fixed 12/5/3/8/2 regardless of state. These
 * tests drive the three real states through the actual RSC:
 *
 *   empty table  → an explicit "no candidates yet" message, never zeros
 *                  dressed up as activity and never invented rows
 *   populated    → counts that equal the rows the repo returned
 *   db failure   → an alert and em-dashes, never a silent zero (a zero would
 *                  read as "nothing is blocked", the most dangerous wrong
 *                  answer on a credentialing surface)
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getWorklistMock = vi.fn();
vi.mock('@/lib/verifier/worklistRepo', () => ({
  getWorklist: (...args: unknown[]) => getWorklistMock(...args),
}));

// LaneHealthMount reaches for runtime source health; not under test here.
vi.mock('@/components/source-health/LaneHealthMount', () => ({
  LaneHealthMount: ({ heading }: { heading: string }) =>
    React.createElement('div', { 'data-testid': 'lane-health' }, heading),
}));

import EmployerDashboardPage from '../app/employer/dashboard/page';

function row(reviewState: string, id: string) {
  return {
    candidateId: id,
    sourceOrganizationName: 'Test Org',
    reviewState,
    decisionGrade: false as const,
    proofTier: 'receipt_candidate' as const,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  };
}

async function render(): Promise<string> {
  const el = await EmployerDashboardPage();
  return renderToStaticMarkup(el as React.ReactElement);
}

/** Text content of the row whose label matches, with tags stripped. */
function countFor(html: string, label: string): string | null {
  const match = html.match(
    new RegExp(`<span>${label}</span><span[^>]*>([^<]*)</span>`),
  );
  return match ? match[1] : null;
}

beforeEach(() => {
  getWorklistMock.mockReset();
});

describe('W0.3 — employer dashboard render states', () => {
  it('empty table renders an explicit empty state, not fabricated counts', async () => {
    getWorklistMock.mockResolvedValueOnce([]);
    const html = await render();

    expect(html).toMatch(/No receipt candidates have been submitted yet/);
    // The exact fabricated figures that used to render unconditionally.
    for (const gone of ['>12<', '>4.2', '1029', '1030']) {
      expect(html).not.toContain(gone);
    }
  });

  it('populated table renders counts equal to the returned rows', async () => {
    getWorklistMock.mockResolvedValueOnce([
      row('pending', 'a'),
      row('pending', 'b'),
      row('in_review', 'c'),
      row('unable_to_verify', 'd'),
    ]);
    const html = await render();

    expect(countFor(html, 'Pending')).toBe('2');
    expect(countFor(html, 'In review')).toBe('1');
    expect(countFor(html, 'Unable to verify')).toBe('1');
    // A state with no rows shows a true zero, not a hidden row.
    expect(countFor(html, 'Acceptable for start')).toBe('0');
  });

  it('database failure shows an alert and withholds numbers', async () => {
    getWorklistMock.mockRejectedValueOnce(new Error('connection refused'));
    const html = await render();

    expect(html).toContain('role="alert"');
    expect(html).toMatch(/Database unavailable/);
    // Critically: NOT "0". An unreachable database must not read as "nothing
    // is pending" on a surface a reviewer uses to decide what to act on.
    expect(countFor(html, 'Pending')).toBe('—');
    expect(countFor(html, 'Unable to verify')).toBe('—');
  });

  it('asks the repo for every review state rather than one slice', async () => {
    getWorklistMock.mockResolvedValueOnce([]);
    await render();
    expect(getWorklistMock).toHaveBeenCalledWith(
      expect.objectContaining({ reviewState: 'all' }),
    );
  });
});

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ClinicianStartPathPanel } from '@/components/activation/ClinicianStartPathPanel';
import type { ActivationLoadResult, ClinicianActivationView } from '@/lib/applications/activationView';

const base = (over: Partial<ClinicianActivationView>): ClinicianActivationView => ({
  applicationId: 'app-1',
  phase: 'not_started',
  startState: 'not_ready',
  requirements: [],
  summary: { total: 0, requiredOpen: 0, hasHardBlocker: false, requiredMet: false },
  ...over,
});

const render = (result: ActivationLoadResult) =>
  renderToStaticMarkup(<ClinicianStartPathPanel result={result} />);

/** The bare word "Verified" as a status label is banned by the truth contract. */
const BANNED = [/\bverified\b/i, /\bhired\b/i, /\bcredentialed\b/i, /\bcleared to (start|work)\b/i];
function expectNoBanned(html: string) {
  for (const p of BANNED) expect(p.test(html), `banned /${p.source}/ matched`).toBe(false);
}

describe('ClinicianStartPathPanel — honest path-to-start', () => {
  it('an empty ledger says it has not begun — never "ready to start"', () => {
    const html = render({ status: 'ok', data: base({ phase: 'not_started' }) });
    expect(html).toContain('hasn');
    expect(html).toMatch(/after an employer accepts/i);
    expect(html).not.toMatch(/ready to start/i);
    expect(html).not.toMatch(/you can start/i);
    expectNoBanned(html);
  });

  it('requirements_met is framed as awaiting the employer decision, not a completed start', () => {
    const html = render({
      status: 'ok',
      data: base({
        phase: 'requirements_met',
        requirements: [
          { id: 'a', label: 'License copy', category: 'evidence', necessity: 'required', status: 'met', owner: 'clinician', isResolved: true, isBlocking: false, dueAt: null, resolvedAt: null },
        ],
        summary: { total: 1, requiredOpen: 0, hasHardBlocker: false, requiredMet: true },
      }),
    });
    expect(html).toMatch(/records the start-ready decision/i);
    expect(html).toMatch(/not a credentialing/i);
    expectNoBanned(html);
  });

  it('never hides a blocked or access-gated requirement behind a ready label', () => {
    const html = render({
      status: 'ok',
      data: base({
        phase: 'in_progress',
        requirements: [
          { id: 'a', label: 'Board certification', category: 'evidence', necessity: 'required', status: 'met', owner: 'clinician', isResolved: true, isBlocking: false, dueAt: null, resolvedAt: null },
          { id: 'b', label: 'State license lookup', category: 'policy', necessity: 'required', status: 'blocked', owner: 'system', isResolved: false, isBlocking: true, dueAt: null, resolvedAt: null },
        ],
        summary: { total: 2, requiredOpen: 1, hasHardBlocker: true, requiredMet: false },
      }),
    });
    // The blocker is visible with its real label and status.
    expect(html).toContain('State license lookup');
    expect(html).toContain('Blocked');
    expect(html).toMatch(/1 required item still open/i);
    expect(html).toMatch(/blocker needs attention/i);
    expectNoBanned(html);
  });

  it('reports a recorded start as "Start recorded", never "hired" or "credentialed"', () => {
    const html = render({
      status: 'ok',
      data: base({
        phase: 'requirements_met',
        startState: 'started',
        requirements: [
          { id: 'a', label: 'X', category: 'evidence', necessity: 'required', status: 'met', owner: 'clinician', isResolved: true, isBlocking: false, dueAt: null, resolvedAt: null },
        ],
        summary: { total: 1, requiredOpen: 0, hasHardBlocker: false, requiredMet: true },
      }),
    });
    expect(html).toContain('Start recorded');
    expectNoBanned(html);
  });

  it('renders an honest message on an unavailable read, and nothing on unauthorized/not-found', () => {
    expect(render({ status: 'error', message: 'Your path to start is temporarily unavailable.' })).toContain(
      'temporarily unavailable',
    );
    expect(render({ status: 'unauthorized' })).toBe('');
    expect(render({ status: 'not_found' })).toBe('');
  });
});

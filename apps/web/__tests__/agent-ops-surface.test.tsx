/**
 * Wave L0 — the Agent Ops surface renders, and renders idleness as idle.
 *
 * The report builder is tested separately (agent-ops-report.test.ts). This
 * pins the thing a builder test cannot: that the doctrine survives the trip
 * to the DOM. An empty cohort that renders a green "healthy" chip would be
 * the exact failure this wave exists to remove, and it would pass every
 * unit test on the report.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AgentOpsClient from '@/components/agent-ops/AgentOpsClient';
import type { AgentOpsReport } from '@/lib/agent/ops/agent-ops-report';

function report(overrides: Partial<AgentOpsReport> = {}): AgentOpsReport {
  return {
    generatedAt: '2026-08-09T12:00:00.000Z',
    windowDays: 7,
    loopState: 'not_enrolled',
    loopStateDetail: 'No subjects are enrolled, so the background loop cannot run.',
    cohort: { enrolled: 0, enabled: 0, disabled: 0, dueNow: 0, nextDueAt: null, failing: 0 },
    activity: {
      runs24h: 0,
      runs7d: 0,
      byTrigger: { interactive: 0, scheduled: 0, event: 0 },
      byMode: { live: 0, shadow: 0 },
      lastRunAt: null,
      policyVersions: [],
    },
    agreement: {
      presented: 0,
      accepted: 0,
      dismissed: 0,
      overridden: 0,
      completed: 0,
      failed: 0,
      overrideRate: null,
      byActionType: [],
    },
    refusals: { blocked: 0, byStatus: [] },
    deltas: { total: 0, material: 0, immaterial: 0, byKind: [] },
    degraded: false,
    notes: [],
    ...overrides,
  };
}

describe('Agent Ops surface', () => {
  it('renders an empty cohort as idle, never as healthy', () => {
    const html = renderToStaticMarkup(<AgentOpsClient initialReport={report()} />);

    expect(html).toContain('Loop idle');
    expect(html).toContain('nobody enrolled');
    // Doctrine L2: success and vacancy must not share a colour.
    expect(html).toContain('var(--watch)');
    expect(html).not.toContain('var(--ok)');
  });

  it('renders a stalled loop in the incident colour', () => {
    const html = renderToStaticMarkup(
      <AgentOpsClient
        initialReport={report({
          loopState: 'enrolled_idle',
          loopStateDetail: '3 subject(s) enrolled and 3 due now, but no scheduled run.',
          cohort: { enrolled: 3, enabled: 3, disabled: 0, dueNow: 3, nextDueAt: null, failing: 0 },
        })}
      />,
    );

    expect(html).toContain('Loop stalled');
    expect(html).toContain('var(--p0)');
  });

  it('renders an unmeasured override rate as an em dash, never 0%', () => {
    const html = renderToStaticMarkup(<AgentOpsClient initialReport={report()} />);

    expect(html).toContain('Override rate');
    expect(html).toContain('—');
    expect(html).not.toContain('0%');
  });

  it('renders a measured override rate as a percentage', () => {
    const html = renderToStaticMarkup(
      <AgentOpsClient
        initialReport={report({
          loopState: 'running',
          agreement: {
            presented: 4,
            accepted: 2,
            dismissed: 1,
            overridden: 1,
            completed: 2,
            failed: 0,
            overrideRate: 0.25,
            byActionType: [
              {
                actionType: 'prepare_share_packet',
                presented: 4,
                accepted: 2,
                dismissed: 1,
                overridden: 1,
                completed: 2,
                failed: 0,
                overrideRate: 0.25,
              },
            ],
          },
        })}
      />,
    );

    expect(html).toContain('25%');
    expect(html).toContain('prepare_share_packet');
  });

  it('says a degraded read is unknown, not zero', () => {
    const html = renderToStaticMarkup(
      <AgentOpsClient initialReport={report({ degraded: true, loopState: 'unknown' })} />,
    );

    expect(html).toContain('unknown, not zero');
  });

  it('states it is read-only', () => {
    const html = renderToStaticMarkup(<AgentOpsClient initialReport={report()} />);
    expect(html).toContain('Read-only');
  });
});

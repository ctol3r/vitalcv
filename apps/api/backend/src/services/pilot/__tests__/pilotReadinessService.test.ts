import { DecisionState } from '@vitalcv/trust-state';
import {
  buildPilotPacket,
  categorizeObjection,
  computeDecisionDistribution,
  computePilotMetrics,
  computePilotReadiness,
  getRecommendedNextAction,
  simulateProviderSet,
  summarizeDecisionState,
  type PilotEmployerContext,
  type PilotSnapshot,
  type PilotTarget,
  type RecommendedNextActionInput,
  type SimulatedProviderScenario,
} from '../pilotReadinessService';
import {
  decisionStateLabel,
  safeTruncateText,
  summarizeItemLabels,
} from '../pilotReadinessUtils';

function buildTarget(overrides: Partial<PilotTarget> = {}): PilotTarget {
  return {
    id: 'pilot-target-1',
    slug: 'openclaw-pilot-1',
    label: 'OpenClaw Pilot 1',
    generatedAt: '2026-04-11T12:00:00.000Z',
    decisionProfile: {
      identity: { verified: true },
      employment: { verified: true },
    },
    criticalItems: [
      {
        id: 'packet',
        label: 'Pilot packet',
        status: 'complete',
        href: '/api/pilot/packet/openclaw-pilot-1',
      },
    ],
    demoPath: [
      {
        id: 'onboarding',
        label: 'Onboarding',
        href: '/onboarding',
        status: 'complete',
        required: true,
      },
      {
        id: 'review',
        label: 'Employer review',
        href: '/review/entity-1',
        status: 'complete',
        required: true,
      },
    ],
    snapshotLinks: [
      {
        kind: 'metrics',
        label: 'Metrics snapshot',
        href: '/api/internal/pilot/kpis?pilotId=openclaw',
      },
    ],
    ...overrides,
  };
}

function buildSnapshot(overrides: Partial<PilotSnapshot> = {}): PilotSnapshot {
  return {
    id: 'pilot-target-1',
    slug: 'openclaw-pilot-1',
    label: 'OpenClaw Pilot 1',
    generatedAt: '2026-04-11T12:00:00.000Z',
    decisionProfile: {
      identity: { verified: true },
      employment: { verified: true },
    },
    criticalItems: [
      {
        id: 'packet',
        label: 'Pilot packet',
        status: 'complete',
        href: '/api/pilot/packet/openclaw-pilot-1',
      },
    ],
    snapshotLinks: [
      {
        kind: 'metrics',
        label: 'Metrics snapshot',
        href: '/api/internal/pilot/kpis?pilotId=openclaw',
      },
    ],
    ...overrides,
  };
}

function buildEmployerContext(overrides: Partial<PilotEmployerContext> = {}): PilotEmployerContext {
  return {
    demoPath: [
      {
        id: 'onboarding',
        label: 'Onboarding',
        href: '/onboarding',
        status: 'complete',
        required: true,
      },
      {
        id: 'review',
        label: 'Employer review',
        href: '/review/entity-1',
        status: 'complete',
        required: true,
      },
    ],
    ...overrides,
  };
}

describe('pilotReadinessService', () => {
  it('computes decision correctness from simulated provider targets', () => {
    const scenarios: SimulatedProviderScenario[] = [
      {
        id: 'ready-cohort',
        label: 'Ready Cohort',
        count: 1,
        decisionProfile: {
          identity: { verified: true },
          employment: { verified: true },
        },
        criticalItems: [
          {
            id: 'packet',
            label: 'Pilot packet',
            status: 'complete',
            href: '/api/pilot/packet/ready',
          },
        ],
        demoPath: [
          {
            id: 'review',
            label: 'Employer review',
            href: '/review/ready',
            status: 'complete',
            required: true,
          },
        ],
        snapshotLinks: [
          {
            kind: 'metrics',
            label: 'Metrics snapshot',
            href: '/api/internal/pilot/kpis?pilotId=ready',
          },
        ],
      },
      {
        id: 'conditional-cohort',
        label: 'Conditional Cohort',
        count: 1,
        decisionProfile: {
          identity: { verified: true },
        },
        criticalItems: [
          {
            id: 'packet',
            label: 'Pilot packet',
            status: 'complete',
            href: '/api/pilot/packet/conditional',
          },
        ],
        demoPath: [
          {
            id: 'review',
            label: 'Employer review',
            href: '/review/conditional',
            status: 'pending',
            required: true,
          },
        ],
        snapshotLinks: [],
      },
      {
        id: 'action-required-cohort',
        label: 'Action Required Cohort',
        count: 1,
        decisionProfile: {
          employment: { verified: true },
        },
        criticalItems: [
          {
            id: 'capsule',
            label: 'Decision capsule',
            status: 'missing',
            href: '/review/action-required',
            detail: 'Decision capsule must exist before review.',
          },
        ],
        demoPath: [
          {
            id: 'review',
            label: 'Employer review',
            href: '/review/action-required',
            status: 'pending',
            required: true,
          },
        ],
        snapshotLinks: [],
      },
      {
        id: 'blocked-cohort',
        label: 'Blocked Cohort',
        count: 1,
        decisionProfile: {
          identity: { verified: false },
          employment: { verified: true },
        },
        criticalItems: [
          {
            id: 'license',
            label: 'State license proof',
            status: 'blocked',
            href: '/passport/blocked',
            detail: 'State license proof is stale.',
          },
        ],
        demoPath: [
          {
            id: 'review',
            label: 'Employer review',
            href: '/review/blocked',
            status: 'blocked',
            required: true,
          },
        ],
        snapshotLinks: [
          {
            kind: 'proof',
            label: 'Proof snapshot',
            href: '/api/internal/pilot/proof?pilotId=blocked',
          },
        ],
      },
    ];

    const generatedAt = '2026-04-11T14:00:00.000Z';
    const targets = simulateProviderSet({ generatedAt, scenarios });
    const distribution = computeDecisionDistribution(targets, generatedAt);
    const canonicalCounts = targets.reduce<Record<DecisionState, number>>((counts, target) => {
      const state = summarizeDecisionState(target).state;
      counts[state] += 1;
      return counts;
    }, {
      [DecisionState.READY]: 0,
      [DecisionState.CONDITIONAL]: 0,
      [DecisionState.BLOCKED]: 0,
      [DecisionState.ACTION_REQUIRED]: 0,
    });

    expect(distribution).toEqual(expect.objectContaining({
      generatedAt,
      totalProviders: 4,
      stateCounts: canonicalCounts,
    }));
    expect(distribution.stateCounts).toEqual({
      [DecisionState.READY]: 1,
      [DecisionState.CONDITIONAL]: 1,
      [DecisionState.BLOCKED]: 1,
      [DecisionState.ACTION_REQUIRED]: 1,
    });
  });

  it('computes completeness accuracy from required demo-path steps only', () => {
    const generatedAt = '2026-04-11T15:00:00.000Z';
    const targets = simulateProviderSet({
      generatedAt,
      scenarios: [
        {
          id: 'mixed-completion',
          label: 'Mixed Completion',
          count: 1,
          decisionProfile: {
            identity: { verified: true },
            employment: { verified: true },
          },
          criticalItems: [
            {
              id: 'packet',
              label: 'Pilot packet',
              status: 'complete',
              href: '/api/pilot/packet/mixed',
            },
          ],
          demoPath: [
            {
              id: 'review',
              label: 'Employer review',
              href: '/review/mixed',
              status: 'complete',
              required: true,
            },
            {
              id: 'optional-export',
              label: 'Optional export',
              href: '/export/mixed',
              status: 'pending',
              required: false,
            },
          ],
          snapshotLinks: [
            {
              kind: 'metrics',
              label: 'Metrics snapshot',
              href: '/api/internal/pilot/kpis?pilotId=mixed',
            },
          ],
        },
        {
          id: 'missing-critical',
          label: 'Missing Critical',
          count: 1,
          decisionProfile: {
            identity: { verified: true },
            employment: { verified: true },
          },
          criticalItems: [
            {
              id: 'snapshot',
              label: 'Pilot metrics snapshot',
              status: 'missing',
              href: '/api/internal/pilot/kpis?pilotId=missing',
              detail: 'Metrics snapshot is required before sharing.',
            },
          ],
          demoPath: [
            {
              id: 'onboarding',
              label: 'Onboarding',
              href: '/onboarding/missing',
              status: 'complete',
              required: true,
            },
            {
              id: 'review',
              label: 'Employer review',
              href: '/review/missing',
              status: 'pending',
              required: true,
            },
            {
              id: 'optional-proof',
              label: 'Optional proof',
              href: '/proof/missing',
              status: 'complete',
              required: false,
            },
          ],
          snapshotLinks: [],
        },
      ],
    });

    const summaries = targets.map((target) => summarizeDecisionState(target));
    const distribution = computeDecisionDistribution(targets, generatedAt);

    expect(summaries.map((summary) => summary.completionPct)).toEqual([100, 50]);
    expect(distribution).toEqual({
      generatedAt,
      totalProviders: 2,
      stateCounts: {
        [DecisionState.READY]: 1,
        [DecisionState.CONDITIONAL]: 0,
        [DecisionState.BLOCKED]: 0,
        [DecisionState.ACTION_REQUIRED]: 1,
      },
      averageCompletionPct: 75,
      providersWithSnapshotLinks: 1,
      providersMissingCriticalItems: 1,
    });
  });

  it('generates deterministic provider sets with stable ids, slugs, and labels', () => {
    const scenarios: SimulatedProviderScenario[] = [
      {
        id: 'ready-cohort',
        label: 'Ready Cohort',
        count: 2,
        decisionProfile: {
          identity: { verified: true },
          employment: { verified: true },
        },
        criticalItems: [
          {
            id: 'packet',
            label: 'Pilot packet',
            status: 'complete',
            href: '/api/pilot/packet/ready',
          },
        ],
        demoPath: [
          {
            id: 'review',
            label: 'Employer review',
            href: '/review/ready',
            status: 'complete',
            required: true,
          },
        ],
        snapshotLinks: [],
      },
    ];

    const input = {
      generatedAt: '2026-04-11T16:00:00.000Z',
      scenarios,
    };

    const first = simulateProviderSet(input);
    const second = simulateProviderSet(input);

    expect(first).toEqual(second);
    expect(first.map((target) => ({
      id: target.id,
      slug: target.slug,
      label: target.label,
    }))).toEqual([
      {
        id: '1-ready-cohort-1',
        slug: '1-ready-cohort-1',
        label: 'Ready Cohort 1',
      },
      {
        id: '1-ready-cohort-2',
        slug: '1-ready-cohort-2',
        label: 'Ready Cohort 2',
      },
    ]);

    first[0]!.criticalItems[0]!.status = 'blocked';

    expect(first[1]!.criticalItems[0]!.status).toBe('complete');
    expect(scenarios[0]!.criticalItems[0]!.status).toBe('complete');
    expect(second[0]!.criticalItems[0]!.status).toBe('complete');
  });

  it('builds a deterministic pilot packet from a typed target', () => {
    const target = buildTarget();

    const packet = buildPilotPacket(target);

    expect(packet).toEqual(expect.objectContaining({
      targetId: 'pilot-target-1',
      targetSlug: 'openclaw-pilot-1',
      generatedAt: '2026-04-11T12:00:00.000Z',
      decisionSummary: expect.objectContaining({
        state: DecisionState.READY,
        label: 'Ready',
        summary: 'OpenClaw Pilot 1 is ready for pilot review.',
      }),
      recommendedNextAction: expect.objectContaining({
        kind: 'share_packet',
        href: '/api/internal/pilot/kpis?pilotId=openclaw',
      }),
    }));
    expect(packet.packetId).toMatch(/^[a-f0-9]{16}$/);
    expect(buildPilotPacket(target).packetId).toBe(packet.packetId);
  });

  it('builds a deterministic pilot packet from a snapshot and employer context', () => {
    const packet = buildPilotPacket(
      buildSnapshot(),
      buildEmployerContext({
        snapshotUrl: 'https://pilot.vitalcv.test/review/openclaw-pilot-1',
        snapshotLabel: 'Employer review snapshot',
      }),
    );

    expect(packet).toEqual(expect.objectContaining({
      targetId: 'pilot-target-1',
      targetSlug: 'openclaw-pilot-1',
      decisionSummary: expect.objectContaining({
        state: DecisionState.READY,
      }),
      recommendedNextAction: expect.objectContaining({
        kind: 'share_packet',
      }),
    }));
    expect(packet.snapshotLinks).toEqual([
      {
        kind: 'metrics',
        label: 'Metrics snapshot',
        href: '/api/internal/pilot/kpis?pilotId=openclaw',
      },
      {
        kind: 'review',
        label: 'Employer review snapshot',
        href: 'https://pilot.vitalcv.test/review/openclaw-pilot-1',
      },
    ]);
  });

  it('aggregates pilot metrics across generated packets', () => {
    const readyPacket = buildPilotPacket(buildTarget());
    const actionRequiredPacket = buildPilotPacket(buildTarget({
      id: 'pilot-target-2',
      slug: 'openclaw-pilot-2',
      label: 'OpenClaw Pilot 2',
      criticalItems: [
        {
          id: 'decision-capsule',
          label: 'Decision capsule',
          status: 'missing',
          href: '/review/entity-2',
          detail: 'Decision capsule must exist before employer review.',
        },
      ],
      demoPath: [
        {
          id: 'onboarding',
          label: 'Onboarding',
          href: '/onboarding',
          status: 'complete',
          required: true,
        },
        {
          id: 'review',
          label: 'Employer review',
          href: '/review/entity-2',
          status: 'pending',
          required: true,
        },
      ],
      snapshotLinks: [],
    }));

    const metrics = computePilotMetrics(
      [readyPacket, actionRequiredPacket],
      '2026-04-11T13:00:00.000Z',
    );

    expect(metrics).toEqual({
      generatedAt: '2026-04-11T13:00:00.000Z',
      totalTargets: 2,
      stateCounts: {
        [DecisionState.READY]: 1,
        [DecisionState.CONDITIONAL]: 0,
        [DecisionState.BLOCKED]: 0,
        [DecisionState.ACTION_REQUIRED]: 1,
      },
      packetsWithSnapshotLinks: 1,
      packetsMissingCriticalItems: 1,
      blockedTargets: 0,
      readyTargets: 1,
      averageDemoPathCompletionPct: 75,
      nextActionCounts: {
        resolve_blocker: 0,
        complete_critical_item: 1,
        advance_demo_path: 0,
        publish_snapshot: 0,
        share_packet: 1,
      },
    });
  });

  it('prioritizes blockers and missing snapshots when recommending next actions', () => {
    const blockedTarget = buildTarget({
      criticalItems: [
        {
          id: 'state-license',
          label: 'State license proof',
          status: 'blocked',
          href: '/passport/entity-1',
          detail: 'State license proof is stale.',
        },
      ],
    });

    expect(getRecommendedNextAction(blockedTarget)).toEqual({
      kind: 'resolve_blocker',
      label: 'Resolve State license proof',
      detail: 'State license proof is stale.',
      href: '/passport/entity-1',
    });

    const noSnapshotTarget = buildTarget({
      snapshotLinks: [],
    });

    expect(getRecommendedNextAction(noSnapshotTarget)).toEqual({
      kind: 'publish_snapshot',
      label: 'Publish pilot snapshot',
      detail: 'Add at least one packet or metrics snapshot before sharing this pilot target.',
      href: null,
    });
  });

  it('selects the next action from normalized packet inputs', () => {
    const input: RecommendedNextActionInput = {
      blockedCriticalItems: [],
      missingCriticalItems: [],
      demoPath: [
        {
          id: 'review',
          label: 'Employer review',
          href: '/review/entity-1',
          status: 'pending',
          required: true,
          detail: 'Open the employer review surface next.',
        },
      ],
      snapshotLinks: [],
    };

    expect(getRecommendedNextAction(input)).toEqual({
      kind: 'advance_demo_path',
      label: 'Open Employer review',
      detail: 'Open the employer review surface next.',
      href: '/review/entity-1',
    });
  });

  it('preserves snapshot links on the packet and reports their presence in the summary', () => {
    const packet = buildPilotPacket(buildTarget({
      snapshotLinks: [
        {
          kind: 'metrics',
          label: 'Metrics snapshot',
          href: '/api/internal/pilot/kpis?pilotId=openclaw',
        },
        {
          kind: 'proof',
          label: 'Proof snapshot',
          href: '/api/internal/pilot/proof?pilotId=openclaw',
        },
      ],
    }));

    expect(packet.snapshotLinks).toHaveLength(2);
    expect(packet.snapshotLinks[1]).toEqual({
      kind: 'proof',
      label: 'Proof snapshot',
      href: '/api/internal/pilot/proof?pilotId=openclaw',
    });
    expect(packet.decisionSummary.hasSnapshotLinks).toBe(true);
  });

  it('treats missing critical items as action required and carries them into the packet', () => {
    const target = buildTarget({
      criticalItems: [
        {
          id: 'snapshot',
          label: 'Pilot metrics snapshot',
          status: 'missing',
          href: '/api/internal/pilot/kpis?pilotId=openclaw',
          detail: 'Metrics snapshot is required before the packet is circulated.',
        },
      ],
    });

    const summary = summarizeDecisionState(target);
    const packet = buildPilotPacket(target);

    expect(summary.state).toBe(DecisionState.ACTION_REQUIRED);
    expect(summary.missingCriticalItems).toEqual([
      {
        id: 'snapshot',
        label: 'Pilot metrics snapshot',
        status: 'missing',
        href: '/api/internal/pilot/kpis?pilotId=openclaw',
        detail: 'Metrics snapshot is required before the packet is circulated.',
      },
    ]);
    expect(packet.recommendedNextAction).toEqual({
      kind: 'complete_critical_item',
      label: 'Complete Pilot metrics snapshot',
      detail: 'Metrics snapshot is required before the packet is circulated.',
      href: '/api/internal/pilot/kpis?pilotId=openclaw',
    });
  });

  it('categorizes employer objections deterministically', () => {
    expect(categorizeObjection('The packet is missing the review link.')).toEqual({
      kind: 'missing_critical_field',
      label: 'Missing critical field',
      text: 'The packet is missing the review link.',
      normalizedText: 'The packet is missing the review link.',
      matchedKeyword: 'missing',
    });

    expect(categorizeObjection('How fresh is this snapshot?')).toEqual({
      kind: 'snapshot_freshness',
      label: 'Snapshot freshness',
      text: 'How fresh is this snapshot?',
      normalizedText: 'How fresh is this snapshot?',
      matchedKeyword: 'fresh',
    });

    expect(categorizeObjection('I need primary source verification before review.')).toEqual({
      kind: 'source_trust',
      label: 'Source trust',
      text: 'I need primary source verification before review.',
      normalizedText: 'I need primary source verification before review.',
      matchedKeyword: 'primary source',
    });
  });

  it('marks missing critical decision fields as action required', () => {
    expect(computePilotReadiness({
      baseState: DecisionState.ACTION_REQUIRED,
      missingDecisionFields: ['identity'],
      missingCriticalItems: 0,
      blockedCriticalItems: 0,
      completedDemoSteps: 1,
      totalDemoSteps: 1,
      hasSnapshotLinks: false,
    })).toEqual({
      state: DecisionState.ACTION_REQUIRED,
      label: 'Action required',
      completionPct: 100,
      missingDecisionFields: ['identity'],
      hasSnapshotLinks: false,
      isReady: false,
    });
  });

  it('includes snapshot URLs from employer context only once', () => {
    const sharedSnapshotUrl = 'https://pilot.vitalcv.test/review/openclaw-pilot-1';
    const packet = buildPilotPacket(
      buildSnapshot({
        snapshotLinks: [
          {
            kind: 'review',
            label: 'Employer snapshot',
            href: sharedSnapshotUrl,
          },
        ],
      }),
      buildEmployerContext({
        snapshotUrl: sharedSnapshotUrl,
      }),
    );

    expect(packet.snapshotLinks).toEqual([
      {
        kind: 'review',
        label: 'Employer snapshot',
        href: sharedSnapshotUrl,
      },
    ]);
  });

  it('extracts deterministic status mapping and safe truncation helpers for OpenClaw summaries', () => {
    expect(decisionStateLabel(DecisionState.BLOCKED)).toBe('Blocked');
    expect(safeTruncateText('  OpenClaw pilot packet is missing a very long operator-owned snapshot label  ', 32)).toBe(
      'OpenClaw pilot packet is missin…',
    );
    expect(summarizeItemLabels([
      { label: 'OpenClaw metrics snapshot' },
      { label: 'OpenClaw proof snapshot' },
      { label: 'OpenClaw metrics snapshot' },
    ])).toBe('OpenClaw metrics snapshot +1 more');
  });
});

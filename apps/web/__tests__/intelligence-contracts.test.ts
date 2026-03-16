import {
  buildSourceEntries,
  normalizeActionsPayload,
  normalizeFindingsPayload,
  normalizeProvidersPayload,
  normalizeSystemHealthPayload,
} from '@/lib/intelligence/contracts';

describe('intelligence contracts', () => {
  it('normalizes and filters providers for watchlist and comparison surfaces', () => {
    const response = normalizeProvidersPayload({
      entries: [
        {
          npi: '1234567890',
          fullName: 'Ada Lovelace',
          specialties: ['Cardiology'],
          credentialCount: 4,
          activeCredentials: 3,
          primaryIssuer: 'ABMS',
          credentialHealth: 'VERIFIED',
          lastVerifiedAt: '2026-03-15T12:00:00.000Z',
          trustScore: 94,
        },
        {
          npi: '1234567891',
          fullName: 'Grace Hopper',
          specialties: ['Neurology'],
          credentialCount: 3,
          activeCredentials: 1,
          primaryIssuer: 'NPPES',
          credentialHealth: 'PENDING',
          lastVerifiedAt: null,
          trustScore: 61,
        },
      ],
    }, 'Ada');

    expect(response.total).toBe(1);
    expect(response.watchlist[0]?.name).toBe('Ada Lovelace');
    expect(response.providers[0]?.risk).toBe('healthy');
  });

  it('maps findings into alerts and source entries', () => {
    const storylineLinksByFindingId = new Map([
      ['finding-1', { storylineId: 'storyline-1', storylineTitle: 'Trust decline' }],
    ]);
    const findings = normalizeFindingsPayload({
      findings: [
        {
          findingId: 'finding-1',
          investigatorId: 'trust_decline',
          findingType: 'trust_decline',
          severity: 'critical',
          status: 'new',
          title: 'Trust score dropped',
          summary: 'Licensure source is stale.',
          explanation: 'Confidence degraded after stale source detection.',
          entityIds: ['provider:1234567890'],
          entities: [
            {
              entityType: 'provider',
              entityId: '1234567890',
              entityLabel: 'Ada Lovelace',
            },
          ],
          metadata: { npi: '1234567890' },
          priorityScore: 0.96,
          confidence: 0.91,
          storylineKey: 'trust_decline:1234567890',
          supportingEvidence: [
            {
              evidenceId: 'e1',
              evidenceType: 'state_board',
              snippet: 'License renewal source last updated 90 days ago.',
              sourceLabel: 'State Board',
              observedAt: '2026-03-15T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-03-15T12:00:00.000Z',
        },
      ],
      total: 1,
    }, {
      storylineLinksByFindingId,
    });

    expect(findings.alerts[0]?.severity).toBe('critical');
    expect(findings.findings[0]?.providerNpi).toBe('1234567890');
    expect(findings.findings[0]?.providerLabel).toBe('Ada Lovelace');
    expect(findings.findings[0]?.storylineId).toBe('storyline-1');

    const sources = buildSourceEntries({
      provider: null,
      findings: findings.findings,
      storylines: [],
      actions: [],
    });

    expect(sources[0]?.kind).toBe('finding');
    expect(sources[0]?.source).toBe('State Board');
  });

  it('preserves source finding links on action normalization', () => {
    const actions = normalizeActionsPayload({
      actions: [
        {
          actionId: 'action-1',
          actionType: 'VERIFY_LICENSE',
          priority: 'HIGH',
          priorityScore: 0.88,
          status: 'PENDING',
          recommendedAction: 'Verify license',
          explanation: 'A linked finding requires follow-up.',
          confidence: 0.86,
          createdAt: '2026-03-15T12:00:00.000Z',
          sourceFindingIds: ['finding-1'],
          targetEntity: {
            entityType: 'provider',
            entityId: '1234567890',
            entityLabel: 'Ada Lovelace',
          },
          evidence: [
            {
              label: 'state_board',
              snippet: 'License freshness degraded.',
              source: 'State Board',
            },
          ],
        },
      ],
      total: 1,
    });

    expect(actions.actions[0]?.providerNpi).toBe('1234567890');
    expect(actions.actions[0]?.targetLabel).toBe('Ada Lovelace');
    expect(actions.actions[0]?.sourceFindingIds).toEqual(['finding-1']);
  });

  it('derives system health cards and overall tone from mixed payloads', () => {
    const health = normalizeSystemHealthPayload({
      systemStatus: {
        overall: 'DEGRADED',
        uptime: '4d 3h',
        verificationHealth: {
          status: 'DEGRADED',
          last24h: 140,
          last1h: 3,
        },
        sourceConnectivity: [
          { source: 'NPPES', status: 'OPERATIONAL', lastSeen: null, artifactCount: 20 },
          { source: 'STATE_BOARD', status: 'OUTAGE', lastSeen: null, artifactCount: 12 },
        ],
        incidents: [
          {
            id: 'inc-1',
            severity: 'CRITICAL',
            title: 'Connector outage',
            description: 'State board connectivity is offline.',
            detectedAt: '2026-03-15T12:00:00.000Z',
          },
        ],
        generatedAt: '2026-03-15T12:00:00.000Z',
      },
      integrity: {
        status: 'CRITICAL',
        checks: [
          { name: 'capsules_have_artifact_hash', passed: false, details: '2 missing hashes', count: 2 },
        ],
      },
      graphIntegrity: {
        orphanedNodes: ['node-1'],
        invalidEdges: ['edge-1'],
        missingCapsuleEdges: ['edge-2'],
      },
    });

    expect(health.overall).toBe('critical');
    expect(health.cards[0]?.label).toBeDefined();
    expect(health.incidents[0]?.title).toBe('Connector outage');
    expect(health.sources[0]?.source).toBe('NPPES');
  });
});

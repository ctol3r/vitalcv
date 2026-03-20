import { describe, expect, it } from 'vitest';
import {
  buildFindingBacklinks,
  buildProviderBacklinks,
  buildStorylineBacklinks,
} from '@/components/intelligence-workspace/page-node-model';
import type {
  InvestigatorFindingDetailResponse,
  ProviderDetailResponse,
  StorylineDetailResponse,
} from '@/lib/intelligence/detail-types';

describe('spatial page node backlinks', () => {
  it('builds provider -> storyline backlinks from provider detail', () => {
    const detail = {
      provider: {
        npi: '1234567890',
        fullName: 'Ada Lovelace',
        providerType: null,
        credential: null,
        npiStatus: null,
        enumerationType: null,
        specialties: [],
        identifiers: [],
        locations: [],
        trustScore: 91,
        riskScore: 12,
        findingCount: 2,
        activeStorylineCount: 1,
        totalCredentialCount: 5,
        activeCredentialCount: 4,
      },
      profile: {} as ProviderDetailResponse['profile'],
      credentials: [],
      findings: [],
      storylines: [
        {
          storylineId: 'story-1',
          title: 'Credential drift',
          severity: 'high',
          status: 'open',
          lastActivityAt: '2026-03-18T00:00:00.000Z',
        },
      ],
      actions: [],
      signals: null,
      intelligence: null,
    } satisfies ProviderDetailResponse;

    expect(buildProviderBacklinks(detail)).toEqual([
      {
        key: 'storyline:story-1',
        type: 'storyline',
        entityId: 'story-1',
        label: 'Credential drift',
        relationship: 'storyline',
      },
    ]);
  });

  it('builds finding -> provider backlinks from finding detail', () => {
    const detail = {
      finding: {
        findingId: 'finding-1',
        investigatorId: 'investigator-1',
        findingType: 'license_gap',
        scope: 'provider',
        severity: 'high',
        title: 'License gap',
        summary: 'Provider missing a required renewal.',
        entityIds: ['1234567890'],
        entities: [
          {
            entityType: 'provider',
            entityId: '1234567890',
            entityLabel: 'Ada Lovelace',
          },
        ],
        supportingEvidence: [],
        confidence: 0.92,
        explanation: 'Missing renewal receipt.',
        status: 'open',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
        firstSeenAt: '2026-03-18T00:00:00.000Z',
        lastSeenAt: '2026-03-18T00:00:00.000Z',
        occurrenceCount: 1,
        priorityScore: 88,
        storylineKey: 'story-key',
        storylineId: 'story-1',
        storylineTitle: 'Credential drift',
        audienceRoles: [],
        metadata: {},
        statusEvents: [],
      },
      relatedStoryline: null,
    } satisfies InvestigatorFindingDetailResponse;

    expect(buildFindingBacklinks(detail)).toEqual([
      {
        key: 'provider:1234567890',
        type: 'provider',
        entityId: '1234567890',
        label: 'Ada Lovelace',
        relationship: 'provider',
      },
    ]);
  });

  it('builds storyline -> finding backlinks from storyline detail', () => {
    const detail = {
      storyline: {
        storylineId: 'story-1',
        fingerprint: 'fingerprint-1',
        storylineType: 'credential_drift',
        perspective: 'provider',
        title: 'Credential drift',
        summary: 'Multiple credential issues are accumulating.',
        whyItMatters: 'This blocks verification readiness.',
        recommendedActions: [],
        severity: 'high',
        confidence: 0.82,
        entityIds: [],
        findingIds: ['finding-1'],
        supportingEvidence: [],
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
        lastActivityAt: '2026-03-18T00:00:00.000Z',
        status: 'open',
        progressionScore: 0.7,
        noveltyScore: 0.4,
        persistenceScore: 0.8,
        escalationThreshold: 0.6,
        timeline: {
          originEvent: {
            eventKey: 'event-1',
            type: 'created',
            summary: 'Storyline created',
            occurredAt: '2026-03-18T00:00:00.000Z',
            findingIds: ['finding-1'],
            metadata: {},
          },
          events: [],
          quietPeriods: 0,
          reactivations: 0,
          lastEventAt: '2026-03-18T00:00:00.000Z',
          lastActivityAt: '2026-03-18T00:00:00.000Z',
          currentStatus: 'open',
        },
        metadata: {},
      },
      findingLinks: [
        {
          findingId: 'finding-1',
          findingCategory: 'license_gap',
          findingSeverity: 'high',
          observedAt: '2026-03-18T00:00:00.000Z',
          weight: 1,
          snapshot: {},
        },
      ],
      entityLinks: [],
      statusEvents: [],
      actionEvents: [],
    } satisfies StorylineDetailResponse;

    expect(buildStorylineBacklinks(detail)).toEqual([
      {
        key: 'finding:finding-1',
        type: 'finding',
        entityId: 'finding-1',
        label: 'HIGH · license gap',
        relationship: 'finding',
      },
    ]);
  });
});

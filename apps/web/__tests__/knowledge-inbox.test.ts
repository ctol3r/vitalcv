import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  acceptInboxSuggestion,
  classifyInboxItem,
} from '../lib/knowledge-inbox/classifyInboxItem';
import { KnowledgeInboxPanel } from '../components/knowledge-inbox/KnowledgeInboxPanel';
import type { KnowledgeInboxItem } from '../lib/knowledge-inbox/types';

const BANNED_COPY = [
  ['fully', 'verified'].join(' '),
  'guaranteed',
  ['instant', 'hire'].join(' '),
  ['blockchain', 'verified'].join(' '),
  ['wallet', 'ready'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['NPPES', 'verified', 'license'].join(' '),
];

function lowerJson(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe('Knowledge Inbox Classification (GOD-3)', () => {
  it('residency text classifies as training', () => {
    const result = classifyInboxItem('Completed residency at Mass General');
    expect(result.itemType).toBe('training');
    expect(result.suggestedProfileSection).toBe('Postgraduate Training');
    expect(result.provenance).toBe('USER_ENTERED');
    expect(result.decisionGrade).toBe(false);
    expect(result.verificationStatus).toBe('not_source_verified');
    expect(result.limitationNote).toContain('not primary-source evidence');
  });

  it('fellowship text classifies as training', () => {
    const result = classifyInboxItem('Cardiology fellowship');
    expect(result.itemType).toBe('training');
  });

  it('DOI/PubMed text classifies as publication/research', () => {
    const result = classifyInboxItem('New paper on PubMed regarding cardiology');
    expect(result.itemType).toBe('publication');
    expect(result.suggestedGraphNode).toBe('Credential Claim (Publication)');
    expect(result.provenance).toBe('INFERRED');
    expect(result.decisionGrade).toBe(false);
    expect(result.limitationNote).toContain('not independently source-matched');
  });

  it('board certification text never becomes source-backed by classification', () => {
    const result = classifyInboxItem(['I am board', 'certified in pediatrics'].join(' '));
    expect(result.itemType).toBe('boardCertification');
    expect(result.provenance).toBe('USER_ENTERED');
    expect(result.proofTier).toBe('source_evidence_required');
    expect(result.decisionGrade).toBe(false);
    expect(result.verificationStatus).toBe('not_source_verified');
    expect(result.limitationNote).toContain('source evidence is required');
    expect(result.nextAction).toContain('Queue for source evidence');
    expect(lowerJson(result)).not.toContain('active');
  });

  it('license text never becomes active or decision-grade without state-board source evidence', () => {
    const result = classifyInboxItem('Medical license #12345 in CA');
    expect(result.itemType).toBe('license');
    expect(result.provenance).toBe('USER_ENTERED');
    expect(result.proofTier).toBe('source_evidence_required');
    expect(result.decisionGrade).toBe(false);
    expect(result.verificationStatus).toBe('not_source_verified');
    expect(result.limitationNote).toContain('state board Primary Source Verification is required');
    expect(lowerJson(result)).not.toContain(['license', 'active'].join(' '));
    expect(lowerJson(result)).not.toContain(['license', 'verified'].join(' '));
  });

  it('unknown text remains unknown', () => {
    const result = classifyInboxItem('I like to play golf on weekends');
    expect(result.itemType).toBe('unknown');
    expect(result.suggestedGraphNode).toBe('Unknown');
    expect(result.decisionGrade).toBe(false);
  });

  it('accepting an inbox suggestion preserves profile-context-only proof tier', () => {
    const classification = classifyInboxItem('Completed residency at Mass General');
    if (classification.itemType === "unknown") throw new Error("Expected valid classification");

    const accepted = acceptInboxSuggestion(classification);

    expect(accepted.proofTier).toBe('profile_context_only');
    expect(accepted.decisionGrade).toBe(false);
    expect(accepted.verificationStatus).toBe('not_source_verified');
    expect(accepted.provenance).toBe('USER_ENTERED');
  });

  it('renders inbox provenance and acceptance copy clearly', () => {
    const items: KnowledgeInboxItem[] = [
      {
        itemId: 'item-1',
        title: 'Residency history',
        itemType: 'training',
        status: 'suggested_to_profile',
        provenance: 'USER_ENTERED',
        confidence: 'Medium',
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-24T00:00:00.000Z',
        verificationStatus: 'not_source_verified',
        suggestedProfileSection: 'Postgraduate Training',
        suggestedGraphNode: 'Credential Claim (Training)',
        limitationNote: 'Profile-entered training context; not primary-source evidence.',
        nextAction: 'Accept as profile context or attach source evidence',
      },
      {
        itemId: 'item-2',
        title: 'Publication match',
        itemType: 'publication',
        status: 'accepted_to_profile',
        provenance: 'INFERRED',
        confidence: 'High',
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-24T00:00:00.000Z',
        verificationStatus: 'not_source_verified',
        suggestedProfileSection: 'Publications',
        suggestedGraphNode: 'Credential Claim (Publication)',
        limitationNote: 'Inferred from text; not independently source-matched.',
        nextAction: 'Accept as profile context or attach source evidence',
      },
    ];

    const markup = renderToStaticMarkup(React.createElement(KnowledgeInboxPanel, { items }));

    expect(markup).toContain('User-entered - not PSV');
    expect(markup).toContain('Inferred - not PSV');
    expect(markup).toContain('Accept as Profile Context');
    expect(markup).toContain('Profile context suggested');
    expect(markup).toContain('Profile context accepted');
    expect(markup).not.toContain('Accept to Profile');
  });

  it('keeps Knowledge Trust Graph machine rules parseable and aligned', () => {
    const raw = readFileSync(
      resolve(process.cwd(), '../../docs/architecture/vitalcv-knowledge-trust-graph.json'),
      'utf8',
    );
    const graph = JSON.parse(raw) as { nodes: string[]; rules: string[] };

    expect(graph.nodes).toContain('Knowledge Inbox');
    expect(graph.nodes).toContain('Uploaded Evidence');
    expect(graph.rules).toEqual(expect.arrayContaining([
      'Inbox classification is not verification. It remains USER_ENTERED or INFERRED until backed by a PSV receipt.',
      'Accepting an inbox suggestion updates profile context, not proof tier.',
    ]));
  });

  it('keeps banned overclaim strings out of classifier and inbox rendering copy', () => {
    const classifierCopy = [
      classifyInboxItem('Medical license #12345 in CA'),
      classifyInboxItem(['I am board', 'certified in pediatrics'].join(' ')),
      classifyInboxItem('New paper on PubMed regarding cardiology'),
    ].map(lowerJson).join('\n');
    const markup = renderToStaticMarkup(React.createElement(KnowledgeInboxPanel, { items: [] })).toLowerCase();

    for (const banned of BANNED_COPY) {
      expect(classifierCopy).not.toContain(banned.toLowerCase());
      expect(markup).not.toContain(banned.toLowerCase());
    }
  });
});

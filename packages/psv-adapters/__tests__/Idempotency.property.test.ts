import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildDeterministicId,
  createCredentialFactBatch,
  createFactEnvelope,
  type IdentityClaimFact,
} from '../core/CredentialFactMapper';
import {
  createEvidencePointer,
  createProvenanceMetadata,
  hashRawResponse,
  hashSensitiveInput,
} from '../core/ProvenanceTracker';

function reverseObjectOrder(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries([...Object.entries(value)].reverse());
}

function buildBatch(payload: Record<string, unknown>) {
  const retrievalTime = '2026-03-12T20:00:00.000Z';
  const rawResponseHash = hashRawResponse(payload);
  const provenance = createProvenanceMetadata({
    source: 'npi-registry',
    retrievalTime,
    retrievalMethod: 'api',
    rawResponse: payload,
    subjectId: '1234567893',
    endpoint: 'https://npiregistry.cms.hhs.gov/api/',
  });
  const fact: IdentityClaimFact = Object.freeze({
    factId: buildDeterministicId('identity_claim', payload),
    factType: 'IdentityClaim',
    subjectId: '1234567893',
    source: 'npi-registry',
    observedAt: retrievalTime,
    npi: '1234567893',
    fullName: 'JANE DOE',
    enumerationType: 'NPI-1',
    taxonomies: Object.freeze(['Family Nurse Practitioner']),
    practiceStates: Object.freeze(['CA']),
  });

  return createCredentialFactBatch({
    subjectId: '1234567893',
    source: 'npi-registry',
    sourceMode: 'PUBLIC_API',
    adapterVersion: '1.0.0',
    retrievalTime,
    queryKind: 'lookupByNpi',
    queryHash: hashSensitiveInput({ npi: '1234567893' }),
    rawResponse: payload,
    rawResponseHash,
    evidencePointer: createEvidencePointer({
      source: 'npi-registry',
      retrievalTime,
      rawResponseHash,
      subjectId: '1234567893',
    }),
    facts: [
      createFactEnvelope({
        fact,
        provenance,
        policy: {
          sourcePolicyId: 'npi-registry',
          retentionDays: 365,
          allowedConsumers: ['INTERNAL_TRUST_ENGINE'],
        },
      }),
    ],
    summary: {
      status: 'ACTIVE',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/',
      factCount: 1,
    },
  });
}

describe('deterministic idempotency properties', () => {
  it('hashes semantically equivalent JSON with different key order to the same raw response hash', () => {
    const recordArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { maxKeys: 6 },
    );

    fc.assert(
      fc.property(recordArb, (record) => {
        expect(hashRawResponse(record)).toBe(hashRawResponse(reverseObjectOrder(record)));
      }),
    );
  });

  it('replays the same raw payload into identical fact ids, batch ids, and idempotency keys', () => {
    const payloadArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 6 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { maxKeys: 5 },
    );

    fc.assert(
      fc.property(payloadArb, (payload) => {
        const first = buildBatch(payload);
        const second = buildBatch(payload);

        expect(first.rawResponseHash).toBe(second.rawResponseHash);
        expect(first.batchId).toBe(second.batchId);
        expect(first.idempotencyKey).toBe(second.idempotencyKey);
        expect(first.facts[0]?.fact.factId).toBe(second.facts[0]?.fact.factId);
      }),
    );
  });
});

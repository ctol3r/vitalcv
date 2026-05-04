import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildIdentityProofingFoundation,
  type IdentityVendorCandidateId,
} from '../lib/identity/identityProofingFoundation';
import {
  getConfiguredIdentityVendorId,
  getMockIdentityProofingVendor,
} from '../lib/identity/mockIdentityProofing';

describe('identity vendor foundation', () => {
  it('keeps mock identity proofing non-live with no IAL claim or selected vendor', () => {
    const foundation = buildIdentityProofingFoundation('mock');
    const mockVendor = getMockIdentityProofingVendor();

    expect(getConfiguredIdentityVendorId('persona')).toBe('mock');
    expect(foundation.isLive).toBe(false);
    expect(foundation.configuredVendorId).toBe('mock');
    expect(foundation.activeVendor).toEqual(mockVendor);
    expect(foundation.activeVendor.isLive).toBe(false);
    expect(foundation.activeVendor.supportsGovernmentId).toBe(false);
    expect(foundation.activeVendor.supportsLiveness).toBe(false);
    expect(foundation.activeVendor.supportsIal2Claim).toBe(false);
    expect(foundation.activeVendor.supportsIal3Claim).toBe(false);
    expect(foundation.vendorSelected).toBe(false);
    expect(foundation.procurementRequired).toBe(true);
    expect(foundation.highestIalClaimed).toBe('none');
    expect(foundation.boardCeilingPercent).toBe(30);

    const candidateIds = foundation.candidates.map((candidate) => candidate.vendorId);
    const expected: IdentityVendorCandidateId[] = [
      'persona',
      'stripe_identity',
      'onfido',
      'veriff',
    ];
    expect(candidateIds).toEqual(expected);
    expect(foundation.candidates.every((candidate) => candidate.selected === false)).toBe(true);
    expect(
      foundation.disclaimers.some((line) =>
        /procurement decision, not engineering/.test(line),
      ),
    ).toBe(true);
  });

  it('documents vendor comparison, IAL gaps, rejected live claims, and the procurement ceiling', () => {
    const vendorEvaluation = readFileSync(
      resolve(process.cwd(), '../../docs/security/identity-vendor-evaluation.md'),
      'utf8',
    );
    const ialPlan = readFileSync(
      resolve(process.cwd(), '../../docs/security/ial-ladder-plan.md'),
      'utf8',
    );
    const docs = `${vendorEvaluation}\n${ialPlan}`;

    expect(docs).toContain('Persona');
    expect(docs).toContain('Stripe Identity');
    expect(docs).toContain('Onfido');
    expect(docs).toContain('Veriff');
    expect(vendorEvaluation).toContain('Recommended first procurement target: Persona');
    expect(docs).toContain('IAL2');
    expect(docs).toContain('IAL3');
    expect(docs).toContain('These rows stay at approximately 30% until vendor procurement closes');
    expect(docs).toContain('This is a procurement decision, not engineering');
    expect(docs).not.toMatch(/IAL[23]\s+(achieved|asserted|obtained|met|granted|verified)/i);
  });
});

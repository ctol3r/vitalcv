/**
 * Start Agent A0 — domain unit tests: canonical vocabularies, deterministic
 * ids, and the forbidden-claim scanner (the shared vocabulary both the
 * runtime truth audit and START-Bench consume).
 *
 * Banned phrases are assembled via split-join so this file never contains
 * them literally (documented escape hatch for the claims gates).
 */
import { describe, expect, it } from 'vitest';
import {
  actionId,
  blockerId,
  contextFingerprint,
  planId,
  stableStringify,
} from '@/lib/agent/ids';
import { scanTextForForbiddenClaims } from '@/lib/agent/forbidden-claims';
import {
  ACTION_OWNERS,
  AGENT_ACTION_TYPES,
  BLOCKER_TYPES,
  EXECUTION_LEVEL_BY_PERMISSION,
  MAX_EXECUTABLE_LEVEL_A0,
  PERMISSION_CLASSES,
  PROVENANCE_CLASSES,
  type StartAgentContext,
} from '@/lib/agent/types';

const BARE_VERIFIED = ['Verif', 'ied'].join('');
const READY_PHRASE = ['ready', 'to', 'start'].join(' ');
const AUTO_VERIFIED = ['automatically', BARE_VERIFIED.toLowerCase()].join(' ');
const CRED_COMPLETE = ['credentialing', 'complete'].join(' ');

function ctx(overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: 'subject-1' },
    identity: { status: 'resolved', evidenceRefs: [] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: { status: 'none', evidenceRefs: [] },
    observations: [],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: '2026-08-07T00:00:00.000Z',
    contextClass: 'test',
    ...overrides,
  };
}

describe('canonical vocabularies', () => {
  it('pins the five owners and five permission classes', () => {
    expect([...ACTION_OWNERS]).toEqual([
      'vitalcv',
      'clinician',
      'employer',
      'source',
      'other_institution',
    ]);
    expect([...PERMISSION_CLASSES]).toEqual([
      'observe',
      'recommend',
      'prepare',
      'execute_with_consent',
      'human_only',
    ]);
  });

  it('maps permissions onto execution levels 0–4 with the A0 ceiling at 2', () => {
    expect(EXECUTION_LEVEL_BY_PERMISSION.observe).toBe(0);
    expect(EXECUTION_LEVEL_BY_PERMISSION.recommend).toBe(1);
    expect(EXECUTION_LEVEL_BY_PERMISSION.prepare).toBe(2);
    expect(EXECUTION_LEVEL_BY_PERMISSION.execute_with_consent).toBe(3);
    expect(EXECUTION_LEVEL_BY_PERMISSION.human_only).toBe(4);
    expect(MAX_EXECUTABLE_LEVEL_A0).toBe(2);
  });

  it('has no generic incomplete blocker type', () => {
    expect(BLOCKER_TYPES).not.toContain('incomplete');
    expect(BLOCKER_TYPES.length).toBeGreaterThanOrEqual(14);
  });

  it('keeps the four mandated provenance classes distinct plus platform_record', () => {
    expect([...PROVENANCE_CLASSES]).toEqual([
      'public_source',
      'clinician_provided',
      'ownership_verified',
      'employer_reviewed',
      'platform_record',
    ]);
  });

  it('exposes the action vocabulary as a closed set', () => {
    expect(AGENT_ACTION_TYPES).toContain('verify_ownership');
    expect(AGENT_ACTION_TYPES).toContain('prepare_share_packet');
    expect(AGENT_ACTION_TYPES).toContain('await_employer_decision');
  });
});

describe('deterministic identity', () => {
  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ a: 1, b: { d: 2, c: 3 } })).toBe(
      stableStringify({ b: { c: 3, d: 2 }, a: 1 }),
    );
  });

  it('context fingerprints and plan ids converge for identical input', () => {
    const a = ctx();
    const b = ctx();
    expect(contextFingerprint(a)).toBe(contextFingerprint(b));
    expect(planId('s', 'v1', contextFingerprint(a))).toBe(planId('s', 'v1', contextFingerprint(b)));
  });

  it('action and blocker ids are stable and discriminator-sensitive', () => {
    expect(actionId('verify_ownership', 'ownership')).toBe(actionId('verify_ownership', 'ownership'));
    expect(actionId('verify_ownership', 'a')).not.toBe(actionId('verify_ownership', 'b'));
    expect(blockerId('x', 'a')).not.toBe(blockerId('y', 'a'));
  });
});

describe('forbidden-claim scanner', () => {
  it('flags the readiness phrase without a canonical determination', () => {
    const hits = scanTextForForbiddenClaims(`You are ${READY_PHRASE}!`, ctx());
    expect(hits.some((h) => h.code === 'ready_to_start_claim')).toBe(true);
  });

  it('permits the readiness phrase only under a canonical ready state', () => {
    const readyCtx = ctx({
      readiness: {
        status: 'ready_to_start',
        determinedBy: 'canonical',
        evidenceRefs: [{ kind: 'system_record', ref: 'activation:1', provenance: 'platform_record' }],
      },
    });
    const hits = scanTextForForbiddenClaims(`Canonical state: ${READY_PHRASE}.`, readyCtx);
    expect(hits.filter((h) => h.code === 'ready_to_start_claim')).toHaveLength(0);
  });

  it('always flags credentialing-completion and auto-verification claims', () => {
    expect(
      scanTextForForbiddenClaims(`Your ${CRED_COMPLETE}!`, ctx()).some(
        (h) => h.code === 'credentialing_complete_claim',
      ),
    ).toBe(true);
    expect(
      scanTextForForbiddenClaims(AUTO_VERIFIED, ctx()).some(
        (h) => h.code === 'auto_verification_claim',
      ),
    ).toBe(true);
  });

  it('flags ownership claims unless ownership is canonically verified', () => {
    const phrase = ['ownership', BARE_VERIFIED.toLowerCase()].join(' ');
    expect(
      scanTextForForbiddenClaims(phrase, ctx()).some((h) => h.code === 'identity_ownership_claim'),
    ).toBe(true);
    const verified = ctx({ ownership: { status: 'verified', evidenceRefs: [] } });
    expect(
      scanTextForForbiddenClaims(phrase, verified).filter((h) => h.code === 'identity_ownership_claim'),
    ).toHaveLength(0);
  });

  it('flags employer approval always, and review claims unless reviewed', () => {
    expect(
      scanTextForForbiddenClaims('approved by employer', ctx()).some(
        (h) => h.code === 'employer_approval_claim',
      ),
    ).toBe(true);
    const opened = ctx({ employerReview: { status: 'opened', evidenceRefs: [] } });
    expect(
      scanTextForForbiddenClaims('the employer reviewed your packet', opened).some(
        (h) => h.code === 'employer_review_claim',
      ),
    ).toBe(true);
    const reviewed = ctx({ employerReview: { status: 'reviewed', evidenceRefs: [] } });
    expect(
      scanTextForForbiddenClaims('the employer reviewed your packet', reviewed).filter(
        (h) => h.code === 'employer_review_claim',
      ),
    ).toHaveLength(0);
  });

  it('rejects the bare label and any unanchored use of the v-word', () => {
    expect(
      scanTextForForbiddenClaims(BARE_VERIFIED, ctx()).some((h) => h.code === 'bare_verified_label'),
    ).toBe(true);
    expect(
      scanTextForForbiddenClaims(`License ${BARE_VERIFIED.toLowerCase()}`, ctx()).some(
        (h) => h.code === 'unsupported_verified_claim',
      ),
    ).toBe(true);
    expect(
      scanTextForForbiddenClaims(`not ${BARE_VERIFIED.toLowerCase()} yet`, ctx()),
    ).toHaveLength(0);
  });
});

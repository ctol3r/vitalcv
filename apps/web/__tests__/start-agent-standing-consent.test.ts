/**
 * A2.5 gate — consent kinds and the first unattended action.
 *
 * The properties: point consent lapses, standing consent expires, neither
 * lapse is a withdrawal, standing is non-disclosing only, and background
 * work runs ONLY under a standing proof re-read at the moment of execution.
 */
import { describe, expect, it, vi } from 'vitest';
import { consentLapsed } from '@/lib/agent/consent/consent-store';
import {
  isStandingEligibleScope,
  POINT_CONSENT_WINDOW_MINUTES,
  STANDING_CONSENT_MAX_DAYS,
  type ConsentProof,
} from '@/lib/agent/consent/types';
import { authorizeConsentForAction } from '@/lib/agent/consent/authorize';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';
import { runAgentTick, BACKGROUND_REFRESH_SCOPE } from '@/lib/agent/schedule/tick';
import { ctx, lane } from '@/lib/agent/bench/temporal-scenarios';

vi.mock('server-only', () => ({}));

const NOW = '2026-08-08T00:00:00.000Z';
const MIN = 60_000;
const DAY = 24 * 60 * 60_000;

describe('point consent lapses; the row does not vanish', () => {
  const grantedAt = new Date(NOW);
  const lapse = (minutes: number) =>
    consentLapsed({
      kind: 'point',
      grantedAt,
      expiresAt: null,
      now: new Date(grantedAt.getTime() + minutes * MIN),
    });

  it('is usable inside the accepted 30-minute window', () => {
    expect(POINT_CONSENT_WINDOW_MINUTES).toBe(30);
    expect(lapse(0)).toBe(false);
    expect(lapse(29)).toBe(false);
  });

  it('stops minting proofs after it — closing the A1 hole', () => {
    // In A1 an unexecuted grant stayed executable forever.
    expect(lapse(30)).toBe(true);
    expect(lapse(60 * 24)).toBe(true);
  });
});

describe('standing consent expires; expiry is not withdrawal', () => {
  const grantedAt = new Date(NOW);
  const expiresAt = new Date(grantedAt.getTime() + STANDING_CONSENT_MAX_DAYS * DAY);

  it('is capped at the accepted 90 days', () => {
    expect(STANDING_CONSENT_MAX_DAYS).toBe(90);
  });

  it('survives long inactivity — the whole point of the wave', () => {
    // A clinician who disappears for three months must come back to CURRENT
    // evidence, not the stale evidence they left. No inactivity lapse.
    expect(
      consentLapsed({
        kind: 'standing',
        grantedAt,
        expiresAt,
        now: new Date(grantedAt.getTime() + 60 * DAY),
      }),
    ).toBe(false);
  });

  it('lapses at expiry', () => {
    expect(
      consentLapsed({ kind: 'standing', grantedAt, expiresAt, now: new Date(expiresAt.getTime()) }),
    ).toBe(true);
  });

  it('treats a standing grant with no expiry as unusable, not as permanent', () => {
    expect(
      consentLapsed({ kind: 'standing', grantedAt, expiresAt: null, now: new Date(NOW) }),
    ).toBe(true);
  });
});

describe('standing consent is non-disclosing only (D1)', () => {
  it('allowlists background refresh and nothing else', () => {
    expect(isStandingEligibleScope('background_refresh:self')).toBe(true);
    expect(isStandingEligibleScope('share_packet:opportunity:opp-42')).toBe(false);
    expect(isStandingEligibleScope('private_holdings_access')).toBe(false);
    // A new scope is non-standing until someone deliberately adds it.
    expect(isStandingEligibleScope('some_future_scope:x')).toBe(false);
  });

  it('refuses to authorize a disclosing action as standing', () => {
    const plan = generateStartPlanV2(ctx(NOW), { now: NOW });
    const forged = {
      ...plan,
      actions: [
        {
          id: 'act_forged',
          type: 'prepare_share_packet' as const,
          title: 't',
          reason: 'r',
          owner: 'vitalcv' as const,
          permission: 'execute_with_consent' as const,
          status: 'ready' as const,
          priority: 1,
          rankTier: 3 as const,
          dependencies: [],
          evidenceRefs: [],
          expectedOutcome: 'o',
          resolvesBlockerIds: [],
          consentScope: 'share_packet:opportunity:opp-42',
          // The mistake a future contributor makes.
          consentKind: 'standing' as const,
        },
      ],
    };
    const result = authorizeConsentForAction(forged, 'act_forged');
    expect(result).toMatchObject({ ok: false, refusal: 'standing_scope_not_eligible' });
  });
});

describe('the plan asks for standing consent, and asks to renew it', () => {
  const stale = ctx(NOW, { observations: [lane('nppes_identity', 'stale', NOW)] });

  it('offers the ask when evidence is ageing and nothing is granted', () => {
    const plan = generateStartPlanV2(stale, { now: NOW });
    const ask = plan.actions.find((a) => a.type === 'enable_background_refresh');
    expect(ask).toBeDefined();
    expect(ask!.consentKind).toBe('standing');
    expect(ask!.consentScope).toBe(BACKGROUND_REFRESH_SCOPE);
    expect(ask!.owner).toBe('clinician');
    // The product sentence, in the action itself.
    expect(ask!.expectedOutcome).toContain('always ask before showing anything');
  });

  it('does not re-ask while a live standing grant exists', () => {
    const granted = ctx(NOW, {
      observations: [lane('nppes_identity', 'stale', NOW)],
      consents: [
        {
          scope: BACKGROUND_REFRESH_SCOPE,
          granted: true,
          kind: 'standing',
          lapsed: false,
          evidenceRefs: [],
        },
      ],
    });
    const plan = generateStartPlanV2(granted, { now: NOW });
    expect(plan.actions.some((a) => a.type === 'enable_background_refresh')).toBe(false);
    expect(plan.actions.some((a) => a.type === 'renew_background_refresh')).toBe(false);
  });

  it('asks to RENEW — not to approve afresh — when the grant lapsed', () => {
    const lapsed = ctx(NOW, {
      observations: [lane('nppes_identity', 'stale', NOW)],
      consents: [
        {
          scope: BACKGROUND_REFRESH_SCOPE,
          granted: true,
          kind: 'standing',
          lapsed: true,
          evidenceRefs: [],
        },
      ],
    });
    const plan = generateStartPlanV2(lapsed, { now: NOW });
    const renew = plan.actions.find((a) => a.type === 'renew_background_refresh');
    expect(renew).toBeDefined();
    // They DID approve. Saying otherwise would be false.
    expect(renew!.reason).toContain('Nothing was withdrawn');
    expect(plan.actions.some((a) => a.type === 'enable_background_refresh')).toBe(false);
  });
});

describe('the first unattended action', () => {
  const emit = vi.fn(async () => ({ persisted: true }));

  function tickDeps(overrides: Record<string, unknown> = {}) {
    return {
      isKilled: async () => false,
      claim: async () => [
        { id: 'id-a', subjectRef: 'subj-a', npi: '1234567893', intervalMinutes: 1440, consecutiveFailures: 0 },
      ],
      onSuccess: async () => {},
      onFailure: async () => {},
      summary: async () => ({ enrolled: 1, enabled: 1, due: 1 }),
      emit,
      ...overrides,
    };
  }

  const standingProof: ConsentProof = {
    consentId: 'c1',
    subjectRef: 'subj-a',
    scope: BACKGROUND_REFRESH_SCOPE,
    kind: 'standing',
    grantedAt: NOW,
    expiresAt: '2026-11-06T00:00:00.000Z',
    verifiedAt: NOW,
  };

  it('withholds execution without a standing proof', async () => {
    const planSubject = vi.fn(async () => ({
      subjectRef: 'subj-a',
      ok: true,
      refreshesExecuted: 0,
      executionWithheld: 'no_standing_consent' as const,
    }));
    const result = await runAgentTick({
      now: new Date(NOW),
      dryRun: false,
      deps: tickDeps({ planSubject, verifyConsent: async () => null }),
    });
    expect(result.refreshesExecuted).toBe(0);
    expect(result.outcomes[0].executionWithheld).toBe('no_standing_consent');
  });

  it('refuses a POINT proof for unattended work, however fresh', async () => {
    // Point consent means "the clinician is here, do it now". Nobody is here.
    const pointProof: ConsentProof = { ...standingProof, kind: 'point', expiresAt: undefined };
    const verifyConsent = vi.fn(async () => pointProof);
    const planSubject = vi.fn(async () => ({
      subjectRef: 'subj-a',
      ok: true,
      refreshesExecuted: 0,
      executionWithheld: 'no_standing_consent' as const,
    }));
    const result = await runAgentTick({
      now: new Date(NOW),
      dryRun: false,
      deps: tickDeps({ planSubject, verifyConsent }),
    });
    expect(result.refreshesExecuted).toBe(0);
  });

  it('reports executed refreshes when a standing proof exists', async () => {
    const planSubject = vi.fn(async () => ({
      subjectRef: 'subj-a',
      ok: true,
      refreshesPlanned: 2,
      refreshesExecuted: 2,
      refreshesFailed: 0,
    }));
    const result = await runAgentTick({
      now: new Date(NOW),
      dryRun: false,
      deps: tickDeps({ planSubject, verifyConsent: async () => standingProof }),
    });
    expect(result.refreshesExecuted).toBe(2);
  });

  it('never executes in a dry run, standing proof or not', async () => {
    const planSubject = vi.fn(async () => ({
      subjectRef: 'subj-a',
      ok: true,
      refreshesExecuted: 0,
      executionWithheld: 'dry_run' as const,
    }));
    const result = await runAgentTick({
      now: new Date(NOW),
      dryRun: true,
      deps: tickDeps({ planSubject, verifyConsent: async () => standingProof }),
    });
    expect(result.refreshesExecuted).toBe(0);
    expect(result.outcomes[0].executionWithheld).toBe('dry_run');
  });

  it('still stops entirely when the kill switch is tripped', async () => {
    const planSubject = vi.fn(async () => ({ subjectRef: 'subj-a', ok: true }));
    const result = await runAgentTick({
      now: new Date(NOW),
      dryRun: false,
      deps: tickDeps({ planSubject, isKilled: async () => true, verifyConsent: async () => standingProof }),
    });
    expect(result.skipped).toBe('killed');
    expect(planSubject).not.toHaveBeenCalled();
  });
});

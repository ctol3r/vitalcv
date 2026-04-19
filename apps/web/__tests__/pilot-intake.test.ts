import { describe, expect, it } from 'vitest';
import {
  buildDefaultBaselineSkeleton,
  computePilotSubmissionHash,
  createPilotRequestRecord,
  DEFAULT_PILOT_SUCCESS_CRITERIA,
  isPilotBaselinePartial,
  isPilotStatusTransitionAllowed,
  resolveNextStepForStatus,
  resolveOwnerForStatus,
  transitionPilotStatus,
  updatePilotBaseline,
  validatePilotIntakeInput,
  type PilotRequestRecord,
  type PilotStatus,
} from '@/lib/pilot/pilot-intake';

const ALL_STATUSES: PilotStatus[] = [
  'requested',
  'qualified',
  'scoping',
  'baseline_captured',
  'ready_to_launch',
  'active',
  'completed',
  'archived',
];

function base(): ReturnType<typeof createPilotRequestRecord> {
  return createPilotRequestRecord({
    orgName: 'Acme Health',
    contactName: 'Jane Smith',
    contactEmail: 'jane@acme.health',
    sourceContext: '/pilot',
    requestedAt: '2026-04-18T00:00:00Z',
  });
}

describe('validatePilotIntakeInput', () => {
  it('rejects missing org name / contact / email', () => {
    const errs = validatePilotIntakeInput({
      orgName: '',
      contactName: '',
      contactEmail: '',
    });
    expect(errs.map((e) => e.field).sort()).toEqual([
      'contactEmail',
      'contactName',
      'orgName',
    ]);
  });

  it('rejects malformed email with a specific reason', () => {
    const errs = validatePilotIntakeInput({
      orgName: 'x',
      contactName: 'y',
      contactEmail: 'not-an-email',
    });
    expect(errs.length).toBe(1);
    expect(errs[0].field).toBe('contactEmail');
    expect(errs[0].reason.toLowerCase()).toContain('valid');
  });

  it('accepts a valid input with zero errors', () => {
    const errs = validatePilotIntakeInput({
      orgName: 'Acme',
      contactName: 'Jane',
      contactEmail: 'jane@acme.health',
    });
    expect(errs).toEqual([]);
  });
});

describe('createPilotRequestRecord', () => {
  it('throws on invalid input rather than returning a blank record', () => {
    expect(() =>
      createPilotRequestRecord({
        orgName: '',
        contactName: '',
        contactEmail: '',
      }),
    ).toThrow();
  });

  it('assigns the canonical pilot_ops owner at creation time (no ownerless records)', () => {
    const record = base();
    expect(record.owner).toBe('pilot_ops');
  });

  it('status starts at "requested" and nextStep is never blank', () => {
    const record = base();
    expect(record.status).toBe('requested');
    expect(record.nextStep.trim().length).toBeGreaterThan(0);
  });

  it('writes an initial audit entry attributing the buyer as the requester', () => {
    const record = base();
    expect(record.auditLog).toHaveLength(1);
    expect(record.auditLog[0].actor).toBe('buyer');
    expect(record.auditLog[0].action).toBe('requested');
    expect(record.auditLog[0].to).toBe('requested');
  });

  it('uses the canonical success-criteria default when none supplied', () => {
    const record = base();
    expect(record.successCriteria.length).toBe(DEFAULT_PILOT_SUCCESS_CRITERIA.length);
    expect(record.successCriteria[0].kind).toBe('comparable_delta');
  });

  it('uses the baseline skeleton when none supplied — every metric starts null + source="unknown"', () => {
    const record = base();
    expect(record.baselineMetrics.every((m) => m.value === null)).toBe(true);
    expect(record.baselineMetrics.every((m) => m.source === 'unknown')).toBe(true);
  });

  it('defaults roleOrWorkflowTarget to "Credentialing review" when absent', () => {
    const record = base();
    expect(record.roleOrWorkflowTarget).toBe('Credentialing review');
  });

  it('produces a deterministic submissionHash for identical input within the same second', () => {
    const record1 = createPilotRequestRecord({
      orgName: 'Acme',
      contactName: 'Jane',
      contactEmail: 'jane@acme.health',
      requestedAt: '2026-04-18T00:00:00Z',
    });
    const record2 = createPilotRequestRecord({
      orgName: 'Acme',
      contactName: 'Jane',
      contactEmail: 'jane@acme.health',
      requestedAt: '2026-04-18T00:00:00Z',
    });
    expect(record1.submissionHash).toBe(record2.submissionHash);
    // Different pilotIds though — each record is its own artifact.
    expect(record1.pilotId).not.toBe(record2.pilotId);
  });

  it('submissionHash changes when org / email / workflow differ', () => {
    const a = computePilotSubmissionHash({
      orgName: 'Acme',
      contactEmail: 'jane@acme.health',
      roleOrWorkflowTarget: 'Credentialing review',
      sourceContext: '/pilot',
      requestedAt: '2026-04-18T00:00:00Z',
    });
    const b = computePilotSubmissionHash({
      orgName: 'Acme',
      contactEmail: 'jane@acme.health',
      roleOrWorkflowTarget: 'Locum placement',
      sourceContext: '/pilot',
      requestedAt: '2026-04-18T00:00:00Z',
    });
    expect(a).not.toBe(b);
  });
});

describe('Status transitions', () => {
  it('every status has a canonical next step (no blank nextStep)', () => {
    for (const status of ALL_STATUSES) {
      expect(resolveNextStepForStatus(status).trim().length).toBeGreaterThan(0);
    }
  });

  it('every status has a canonical owner (no ownerless status)', () => {
    for (const status of ALL_STATUSES) {
      const owner = resolveOwnerForStatus(status);
      expect(owner).toBeDefined();
    }
  });

  it('requested -> qualified is allowed; requested -> active is NOT', () => {
    expect(isPilotStatusTransitionAllowed('requested', 'qualified')).toBe(true);
    expect(isPilotStatusTransitionAllowed('requested', 'active')).toBe(false);
  });

  it('archived is terminal — no outgoing transitions', () => {
    for (const to of ALL_STATUSES) {
      expect(isPilotStatusTransitionAllowed('archived', to)).toBe(false);
    }
  });

  it('transitionPilotStatus reassigns owner + nextStep per the new status', () => {
    const record = base();
    const qualified = transitionPilotStatus(record, 'qualified', { actor: 'operator' });
    expect(qualified.owner).toBe(resolveOwnerForStatus('qualified'));
    expect(qualified.nextStep).toBe(resolveNextStepForStatus('qualified'));

    const scoped = transitionPilotStatus(qualified, 'scoping', { actor: 'operator' });
    // Scoping is owned by solutions_engineer, not pilot_ops.
    expect(scoped.owner).toBe('solutions_engineer');
  });

  it('transitionPilotStatus appends an audit entry with actor + from/to', () => {
    const record = base();
    const qualified = transitionPilotStatus(record, 'qualified', {
      actor: 'operator',
      at: '2026-04-19T00:00:00Z',
      note: 'scope call booked',
    });
    expect(qualified.auditLog).toHaveLength(2);
    expect(qualified.auditLog[1]).toMatchObject({
      actor: 'operator',
      action: 'status_change',
      from: 'requested',
      to: 'qualified',
      note: 'scope call booked',
    });
  });

  it('throws on a disallowed transition', () => {
    const record = base();
    expect(() =>
      transitionPilotStatus(record, 'active', { actor: 'operator' }),
    ).toThrow();
  });
});

describe('Baseline updates', () => {
  it('isPilotBaselinePartial true for a fresh record (skeleton values are null)', () => {
    const record = base();
    expect(isPilotBaselinePartial(record)).toBe(true);
  });

  it('updatePilotBaseline only works during "scoping" status', () => {
    const record = base(); // requested
    expect(() =>
      updatePilotBaseline(record, buildDefaultBaselineSkeleton(), { actor: 'operator' }),
    ).toThrow();
  });

  it('captures real baseline values when operator supplies them during scoping', () => {
    let r: PilotRequestRecord = base();
    r = transitionPilotStatus(r, 'qualified', { actor: 'operator' });
    r = transitionPilotStatus(r, 'scoping', { actor: 'operator' });
    r = updatePilotBaseline(
      r,
      [
        {
          key: 'current_time_to_start_days',
          label: 'Current median days from hire to start',
          value: 63,
          source: 'buyer_reported',
        },
        {
          key: 'current_time_to_first_review_days',
          label: 'Current median days from application to first review',
          value: 11,
          source: 'buyer_reported',
        },
        {
          key: 'applications_per_month',
          label: 'Typical applications per month',
          value: 40,
          source: 'buyer_reported',
        },
        {
          key: 'reviews_per_month',
          label: 'Typical reviews per month',
          value: 40,
          source: 'buyer_reported',
        },
      ],
      { actor: 'operator' },
    );
    expect(isPilotBaselinePartial(r)).toBe(false);
    expect(r.baselineMetrics.every((m) => m.value !== null)).toBe(true);
    expect(r.auditLog[r.auditLog.length - 1].action).toBe('baseline_updated');
  });

  it('baseline with any buyer-unknown value keeps isPilotBaselinePartial true', () => {
    let r: PilotRequestRecord = base();
    r = transitionPilotStatus(r, 'qualified', { actor: 'operator' });
    r = transitionPilotStatus(r, 'scoping', { actor: 'operator' });
    r = updatePilotBaseline(
      r,
      [
        {
          key: 'current_time_to_start_days',
          label: 'Current median days from hire to start',
          value: 63,
          source: 'buyer_reported',
        },
        {
          key: 'applications_per_month',
          label: 'Typical applications per month',
          value: null,
          source: 'unknown',
          note: 'buyer does not track this yet',
        },
      ],
      { actor: 'operator' },
    );
    expect(isPilotBaselinePartial(r)).toBe(true);
  });
});

describe('Success criteria defaults — no fake absolute targets', () => {
  it('every default criterion uses comparable_delta or qualitative_signal (never absolute_target)', () => {
    for (const c of DEFAULT_PILOT_SUCCESS_CRITERIA) {
      expect(c.kind).not.toBe('absolute_target');
    }
  });

  it('default criteria that require baseline are flagged correctly', () => {
    const requiresBaseline = DEFAULT_PILOT_SUCCESS_CRITERIA.filter((c) => c.requiresBaseline);
    expect(requiresBaseline.length).toBeGreaterThan(0);
    for (const c of requiresBaseline) {
      // Summary must reference the baseline / before-after relationship.
      expect(c.summary.toLowerCase()).toMatch(/baseline|before|after|compar/);
    }
  });

  it('qualitative-signal defaults never claim a numeric target', () => {
    const qualitative = DEFAULT_PILOT_SUCCESS_CRITERIA.filter((c) => c.kind === 'qualitative_signal');
    for (const c of qualitative) {
      expect(c.summary).not.toMatch(/\d+%/);
      expect(c.summary).not.toMatch(/\bby \d+\b/);
    }
  });
});

describe('Contract invariants — no ownerless / no blank-nextStep records', () => {
  it('every status resolves to a defined owner role', () => {
    const owners = new Set(ALL_STATUSES.map(resolveOwnerForStatus));
    // At least two distinct owners should exist across the lifecycle
    // (pilot_ops handles request + archived; solutions_engineer handles
    // scoping; customer_success handles active). Sanity check.
    expect(owners.size).toBeGreaterThanOrEqual(2);
  });

  it('post-transition records always carry a fresh nextStep matching the new status', () => {
    let r = base();
    const legalChain: PilotStatus[] = [
      'qualified',
      'scoping',
      'baseline_captured',
      'ready_to_launch',
      'active',
      'completed',
    ];
    for (const next of legalChain) {
      r = transitionPilotStatus(r, next, { actor: 'operator' });
      expect(r.nextStep).toBe(resolveNextStepForStatus(next));
      expect(r.nextStep.trim().length).toBeGreaterThan(0);
    }
  });
});

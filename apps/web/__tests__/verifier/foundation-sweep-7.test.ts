import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DecisionPanel } from '../../components/verifier/DecisionPanel';
import { WorklistPanel } from '../../components/verifier/WorklistPanel';
import {
  buildOrgRolesFoundation,
  explainOrgRole,
  type OrgRole,
} from '../../lib/verifier/orgRolesFoundation';
import {
  buildPolicyDecisionFoundation,
  getPolicyDecisionCopy,
  policyDecisionRequiresEscalation,
  type PolicyDecisionOutcome,
} from '../../lib/verifier/policyDecisionFoundation';
import {
  buildReuseDecisionFoundation,
  explainReuseBasis,
  getReuseWarning,
  type ReuseDecision,
  type ReuseDecisionBasis,
} from '../../lib/verifier/reuseDecisionFoundation';
import {
  buildReviewStatusFoundation,
  getReviewStatusCopy,
  transitionAllowed,
  type ReviewLifecycleState,
} from '../../lib/verifier/reviewStatusFoundation';
import {
  buildWorklistFoundation,
  explainWorklistStatus,
  filterWorklist,
  type WorklistItem,
  type WorklistItemStatus,
} from '../../lib/verifier/worklist';

const WEB_ROOT = resolve(__dirname, '..', '..');
const readWebFile = (relativePath: string) =>
  readFileSync(resolve(WEB_ROOT, relativePath), 'utf-8');

const decisionTerms = ['approv' + 'ed', 'reject' + 'ed'];
const buttonTerms = ['Approv' + 'e', 'Reject'];
const reuseDriftTerm = ['re', 'verified'].join('-');

const sampleItems: WorklistItem[] = [
  {
    clinicianNpi: '1003000126',
    submittedAt: '2026-04-28T16:20:00.000Z',
    status: 'pending',
    proofTier: 'receipt_candidate',
  },
  {
    clinicianNpi: '1234567893',
    submittedAt: '2026-04-27T19:10:00.000Z',
    status: 'in_review',
    proofTier: 'psv_sourced',
  },
  {
    clinicianNpi: '1999999984',
    submittedAt: '2026-04-26T14:35:00.000Z',
    status: 'info_requested',
    proofTier: 'self_attested',
  },
  {
    clinicianNpi: '1888888876',
    submittedAt: '2026-04-25T10:00:00.000Z',
    status: 'acceptable_for_start',
    proofTier: 'psv_sourced',
  },
  {
    clinicianNpi: '1777777765',
    submittedAt: '2026-04-24T10:00:00.000Z',
    status: 'unable_to_verify',
    proofTier: 'receipt_candidate',
  },
];

describe('orgRolesFoundation', () => {
  const foundation = buildOrgRolesFoundation();

  it('keeps role provisioning, invitations, and RBAC non-live', () => {
    expect(foundation.provisionLive).toBe(false);
    expect(foundation.invitationSystemLive).toBe(false);
    expect(foundation.rbacEnforced).toBe(false);
  });

  it('defines the three requested org roles', () => {
    expect(foundation.roles).toEqual(['admin', 'reviewer', 'read_only']);
  });

  it('defines member and invitation lifecycle statuses', () => {
    expect(foundation.memberStatuses).toEqual(['active', 'invited', 'suspended']);
    expect(foundation.invitationStatuses).toEqual(['pending', 'accepted', 'expired', 'revoked']);
  });

  it('explains every role with non-empty text', () => {
    for (const role of foundation.roles) {
      expect(explainOrgRole(role).length).toBeGreaterThan(20);
    }
  });

  it('does not overclaim admin scope as full control', () => {
    expect(explainOrgRole('admin').toLowerCase()).not.toContain('full control');
  });

  it('role explainers state no live permissions are granted', () => {
    for (const role of foundation.roles) {
      expect(explainOrgRole(role)).toContain('no live permissions');
    }
  });

  it('role explainers do not use decision approval language', () => {
    const text = foundation.roles.map((role) => explainOrgRole(role)).join(' ').toLowerCase();
    for (const term of decisionTerms) {
      expect(text).not.toContain(term);
    }
  });
});

describe('worklist foundation', () => {
  const foundation = buildWorklistFoundation();

  it('keeps worklist persistence and realtime updates non-live', () => {
    expect(foundation.provisionLive).toBe(false);
    expect(foundation.dbBackedWorklist).toBe(false);
    expect(foundation.realTimeUpdates).toBe(false);
  });

  it('defines all requested worklist statuses', () => {
    expect(foundation.statuses).toEqual([
      'pending',
      'in_review',
      'info_requested',
      'acceptable_for_start',
      'unable_to_verify',
    ]);
  });

  it('defines all requested proof tiers', () => {
    expect(foundation.proofTiers).toEqual([
      'receipt_candidate',
      'psv_sourced',
      'self_attested',
    ]);
  });

  it('filters by status', () => {
    expect(filterWorklist(sampleItems, { status: 'in_review' })).toEqual([sampleItems[1]]);
  });

  it('filters by proof tier', () => {
    expect(filterWorklist(sampleItems, { proofTier: 'psv_sourced' })).toEqual([
      sampleItems[1],
      sampleItems[3],
    ]);
  });

  it('filters by clinician NPI substring', () => {
    expect(filterWorklist(sampleItems, { clinicianNpi: '9999' })).toEqual([sampleItems[2]]);
  });

  it('filters by submitted date bounds', () => {
    expect(filterWorklist(sampleItems, {
      submittedFrom: '2026-04-26T00:00:00.000Z',
      submittedTo: '2026-04-27T23:59:59.999Z',
    })).toEqual([sampleItems[1], sampleItems[2]]);
  });

  it('returns all items for an empty filter', () => {
    expect(filterWorklist(sampleItems, {})).toEqual(sampleItems);
  });

  it('explains every worklist status', () => {
    for (const status of foundation.statuses) {
      expect(explainWorklistStatus(status).length).toBeGreaterThan(20);
    }
  });

  it('pending status copy says pending review, not a positive verified state', () => {
    const copy = explainWorklistStatus('pending').toLowerCase();
    expect(copy).toContain('pending review');
    expect(copy).not.toContain('verified');
  });

  it('acceptable_for_start status uses acceptable language without guarantee terms', () => {
    const copy = explainWorklistStatus('acceptable_for_start').toLowerCase();
    expect(copy).toContain('acceptable for start');
    expect(copy).not.toContain('guarantee');
  });
});

describe('review status foundation', () => {
  const foundation = buildReviewStatusFoundation();

  it('keeps automated decisions and production workflow non-live', () => {
    expect(foundation.provisionLive).toBe(false);
    expect(foundation.automatedDecisions).toBe(false);
    expect(foundation.productionWorkflowLive).toBe(false);
  });

  it('defines the six requested lifecycle states', () => {
    expect(foundation.states).toEqual([
      'not_started',
      'consent_pending',
      'request_sent',
      'response_received',
      'assessment_complete',
      'unable_to_assess',
    ]);
  });

  it('allows the first forward transition', () => {
    expect(transitionAllowed('not_started', 'consent_pending')).toBe(true);
  });

  it('allows request_sent to response_received', () => {
    expect(transitionAllowed('request_sent', 'response_received')).toBe(true);
  });

  it('allows terminal inability from an in-flight request', () => {
    expect(transitionAllowed('request_sent', 'unable_to_assess')).toBe(true);
  });

  it('does not allow backward transitions', () => {
    expect(transitionAllowed('response_received', 'request_sent')).toBe(false);
  });

  it('does not allow skipped forward transitions', () => {
    expect(transitionAllowed('not_started', 'response_received')).toBe(false);
  });

  it('does not allow transitions out of terminal states', () => {
    expect(transitionAllowed('assessment_complete', 'response_received')).toBe(false);
    expect(transitionAllowed('unable_to_assess', 'request_sent')).toBe(false);
  });

  it('returns headline and detail for every lifecycle state', () => {
    for (const state of foundation.states) {
      const copy = getReviewStatusCopy(state);
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
    }
  });

  it('review status copy does not contain approval or rejection terms', () => {
    const text = foundation.states
      .map((state) => Object.values(getReviewStatusCopy(state)).join(' '))
      .join(' ')
      .toLowerCase();
    for (const term of decisionTerms) {
      expect(text).not.toContain(term);
    }
  });
});

describe('reuse decision foundation', () => {
  const foundation = buildReuseDecisionFoundation();

  it('keeps cross-tenant reuse and automatic reuse non-live', () => {
    expect(foundation.provisionLive).toBe(false);
    expect(foundation.crossTenantReuseImplemented).toBe(false);
    expect(foundation.automaticReuseEnabled).toBe(false);
  });

  it('defines all requested reuse bases', () => {
    expect(foundation.basisOptions).toEqual([
      'prior_psv_receipt',
      'prior_assessment',
      'self_attested_only',
    ]);
  });

  it('prior PSV receipt basis says previously assessed and not the drift term', () => {
    const copy = explainReuseBasis('prior_psv_receipt').toLowerCase();
    expect(copy).toContain('previously assessed');
    expect(copy).not.toContain(reuseDriftTerm);
  });

  it('prior assessment basis says previously assessed and not the drift term', () => {
    const copy = explainReuseBasis('prior_assessment').toLowerCase();
    expect(copy).toContain('previously assessed');
    expect(copy).not.toContain(reuseDriftTerm);
  });

  it('self_attested_only basis receives a warning', () => {
    expect(getReuseWarning('self_attested_only')).toContain('Self-attested input');
  });

  it('source-backed reuse bases do not receive warnings', () => {
    expect(getReuseWarning('prior_psv_receipt')).toBeNull();
    expect(getReuseWarning('prior_assessment')).toBeNull();
  });

  it('ReuseDecision carries the requested fields', () => {
    const decision: ReuseDecision = {
      basis: 'prior_assessment',
      assessedAt: '2026-04-20T12:00:00.000Z',
      issuingOrgId: 'org_123',
      expiresAt: '2026-07-20T12:00:00.000Z',
      note: 'Foundation sample only.',
    };

    expect(Object.keys(decision)).toEqual([
      'basis',
      'assessedAt',
      'issuingOrgId',
      'expiresAt',
      'note',
    ]);
  });

  it('explains every reuse basis', () => {
    for (const basis of foundation.basisOptions) {
      expect(explainReuseBasis(basis).length).toBeGreaterThan(20);
    }
  });
});

describe('policy decision foundation', () => {
  const foundation = buildPolicyDecisionFoundation();

  it('keeps automated policy and committee workflows non-live', () => {
    expect(foundation.provisionLive).toBe(false);
    expect(foundation.automatedPolicyEngine).toBe(false);
    expect(foundation.committeeWorkflowLive).toBe(false);
  });

  it('defines all requested policy outcomes', () => {
    expect(foundation.outcomes).toEqual([
      'acceptable_for_start',
      'requires_committee_review',
      'pending_additional_info',
      'unable_to_assess',
    ]);
  });

  it('policy decision copy never uses approval or rejection terms', () => {
    const text = foundation.outcomes
      .map((outcome) => Object.values(getPolicyDecisionCopy(outcome)).join(' '))
      .join(' ')
      .toLowerCase();
    for (const term of decisionTerms) {
      expect(text).not.toContain(term);
    }
  });

  it('committee outcome copy says requires committee review', () => {
    expect(getPolicyDecisionCopy('requires_committee_review').detail.toLowerCase())
      .toContain('requires committee review');
  });

  it('acceptable outcome action uses acceptable_for_start language', () => {
    expect(getPolicyDecisionCopy('acceptable_for_start').action)
      .toBe('Mark acceptable for start');
  });

  it('committee outcome requires escalation', () => {
    expect(policyDecisionRequiresEscalation('requires_committee_review')).toBe(true);
  });

  it('non-committee outcomes do not require escalation', () => {
    const outcomes: PolicyDecisionOutcome[] = [
      'acceptable_for_start',
      'pending_additional_info',
      'unable_to_assess',
    ];
    for (const outcome of outcomes) {
      expect(policyDecisionRequiresEscalation(outcome)).toBe(false);
    }
  });

  it('every policy outcome returns action and detail copy', () => {
    for (const outcome of foundation.outcomes) {
      const copy = getPolicyDecisionCopy(outcome);
      expect(copy.action.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('verifier component and page copy invariants', () => {
  it('WorklistPanel renders the required legal-verification disclaimer', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorklistPanel, { items: sampleItems }),
    );

    expect(markup).toContain(
      'This worklist reflects submitted applications. Review outcomes do not constitute legal verification.',
    );
  });

  it('WorklistPanel renders pending review copy and raw proof tier badges', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorklistPanel, { items: sampleItems }),
    );

    expect(markup).toContain('Pending review');
    expect(markup).toContain('receipt_candidate');
    expect(markup).toContain('psv_sourced');
    expect(markup).toContain('self_attested');
  });

  it('WorklistPanel status labels do not render positive verified copy', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorklistPanel, { items: sampleItems }),
    ).toLowerCase();

    expect(markup).not.toContain('status: verified');
    expect(markup).not.toContain('>verified<');
  });

  it('DecisionPanel renders the four requested decision buttons', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DecisionPanel, { item: sampleItems[2] }),
    );

    expect(markup).toContain('Mark acceptable for start');
    expect(markup).toContain('Request additional info');
    expect(markup).toContain('Escalate to committee');
    expect(markup).toContain('Unable to assess');
  });

  it('DecisionPanel has no approval or rejection button text', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DecisionPanel, { item: sampleItems[2] }),
    );

    for (const term of buttonTerms) {
      expect(markup).not.toContain(`>${term}<`);
    }
  });

  it('DecisionPanel renders the required employment-eligibility disclaimer', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DecisionPanel, { item: sampleItems[2] }),
    );

    expect(markup).toContain(
      'Decisions recorded here are internal assessment records. VitalCV does not guarantee employment eligibility.',
    );
  });

  it('DecisionPanel renders the self-attested reuse warning', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DecisionPanel, { item: sampleItems[2] }),
    );

    expect(markup).toContain('Self-attested input needs source review');
  });

  it('employer worklist shell is wired to the live DB-backed worklist repo', () => {
    const src = readWebFile('app/employer/worklist/page.tsx');
    // DB integration is now live (PR superseding #241): the page imports
    // getWorklist from the verifier worklistRepo and renders rows via
    // WorklistPanel. The earlier placeholder copy "Worklist is connected
    // to submitted applications. Live DB integration" was replaced when
    // the live read landed.
    expect(src).toContain("from '@/lib/verifier/worklistRepo'");
    expect(src).toContain('getWorklist');
    expect(src).toContain('WorklistPanel');
  });

  it('employer decision shell carries the planned recording copy and read-only area', () => {
    const src = readWebFile('app/employer/decision/[applicationId]/page.tsx');
    expect(src).toContain('Decision recording is planned for the production workflow.');
    expect(src).toContain('Read-only outcome area');
  });

  it('new verifier files do not contain banned truth-drift phrases', () => {
    const bannedPhrases = [
      ['approval', 'guarantee'].join(' '),
      ['legally', 'approv' + 'ed'].join(' '),
      ['re', 'verified'].join('-'),
      ['always', 'available'].join(' '),
      ['tamper', 'proof'].join('-'),
      ['hipaa', 'compliant'].join(' '),
      ['soc2', 'certified'].join(' '),
      ['hipaa', 'certified'].join(' '),
      ['wcag', 'certified'].join(' '),
    ];

    const newFiles = [
      'lib/verifier/orgRolesFoundation.ts',
      'lib/verifier/worklist.ts',
      'lib/verifier/reviewStatusFoundation.ts',
      'lib/verifier/reuseDecisionFoundation.ts',
      'lib/verifier/policyDecisionFoundation.ts',
      'components/verifier/WorklistPanel.tsx',
      'components/verifier/DecisionPanel.tsx',
      'app/employer/worklist/page.tsx',
      'app/employer/decision/[applicationId]/page.tsx',
      '__tests__/verifier/foundation-sweep-7.test.ts',
    ];

    for (const file of newFiles) {
      const text = readWebFile(file).toLowerCase();
      for (const phrase of bannedPhrases) {
        expect(text).not.toContain(phrase);
      }
    }
  });
});

describe('typed coverage helpers compile through explicit unions', () => {
  it('covers every review state through a typed list', () => {
    const states: ReviewLifecycleState[] = buildReviewStatusFoundation().states;
    expect(states.map((state) => getReviewStatusCopy(state).headline)).toHaveLength(6);
  });

  it('covers every worklist status through a typed list', () => {
    const statuses: WorklistItemStatus[] = buildWorklistFoundation().statuses;
    expect(statuses.map(explainWorklistStatus)).toHaveLength(5);
  });

  it('covers every reuse basis through a typed list', () => {
    const bases: ReuseDecisionBasis[] = buildReuseDecisionFoundation().basisOptions;
    expect(bases.map(explainReuseBasis)).toHaveLength(3);
  });
});

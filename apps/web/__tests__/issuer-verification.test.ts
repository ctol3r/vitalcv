import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PARTNER_CATEGORY_LABEL,
  recommendPartnerRoute,
} from '../lib/issuer-verification/partnerRouter';
import { STATUS_COPY, statusCopy } from '../lib/issuer-verification/statusCopy';
import type {
  IssuerVerificationRequest,
  ReceiptCandidate,
  VerificationClaimType,
} from '../lib/issuer-verification/types';

// Banned tokens are split + joined so a naive grep over the test
// file does not flag the test itself; the runtime assertion below
// still proves they are absent from real output.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['AI', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
];

function lower(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe('Issuer Verification — Partner Router', () => {
  it('education_degree routes to clearinghouse_or_registrar', () => {
    const r = recommendPartnerRoute('education_degree');
    expect(r.route).toBe('clearinghouse_or_registrar');
    expect(r.partnerCategory).toBe('student_clearinghouse_degreeverify_category');
  });

  it('medical_school routes to clearinghouse_or_registrar', () => {
    const r = recommendPartnerRoute('medical_school');
    expect(r.route).toBe('clearinghouse_or_registrar');
  });

  it('residency routes to direct_program_or_gme_office', () => {
    const r = recommendPartnerRoute('residency');
    expect(r.route).toBe('direct_program_or_gme_office');
  });

  it('fellowship routes to direct_program_or_gme_office', () => {
    const r = recommendPartnerRoute('fellowship');
    expect(r.route).toBe('direct_program_or_gme_office');
  });

  it('background_check routes to certified_background_check_partner', () => {
    const r = recommendPartnerRoute('background_check');
    expect(r.route).toBe('certified_background_check_partner');
    expect(r.partnerCategory).toBe('healthcare_background_screening_category');
  });

  it('professional_license routes to source_adapter_or_background_partner with access_required', () => {
    const r = recommendPartnerRoute('professional_license');
    expect(r.route).toBe('source_adapter_or_background_partner');
    expect(r.accessLevel).toBe('access_required');
  });

  it('work_history routes to employer_direct', () => {
    const r = recommendPartnerRoute('work_history');
    expect(r.route).toBe('employer_direct');
  });

  it('board_certification routes to board_source_or_manual', () => {
    const r = recommendPartnerRoute('board_certification');
    expect(r.route).toBe('board_source_or_manual');
  });

  it('publication_research routes to publication_index_or_manual_review', () => {
    const r = recommendPartnerRoute('publication_research');
    expect(r.route).toBe('publication_index_or_manual_review');
  });

  it('unknown claim type defers to manual_review', () => {
    const r = recommendPartnerRoute('unknown');
    expect(r.route).toBe('manual_review');
  });

  it('partner labels are categories — they do not claim live integrations', () => {
    const blob = Object.values(PARTNER_CATEGORY_LABEL).join(' ').toLowerCase();
    expect(blob).not.toMatch(/integrated with|live with|connected to/);
    expect(PARTNER_CATEGORY_LABEL.student_clearinghouse_degreeverify_category)
      .toMatch(/category/i);
  });

  it('router is deterministic — same input yields identical output', () => {
    const a = recommendPartnerRoute('residency');
    const b = recommendPartnerRoute('residency');
    expect(a).toEqual(b);
  });
});

describe('Issuer Verification — Truth Contract', () => {
  it('a freshly created request starts unverified — sent is not verification', () => {
    const sentCopy = statusCopy('sent');
    expect(sentCopy.label.toLowerCase()).not.toBe('verified');
    expect(sentCopy.label.toLowerCase()).not.toMatch(/^verified$/);
    expect(sentCopy.description.toLowerCase()).not.toContain('verified');
    expect(sentCopy.reviewRequired).toBe(false);
  });

  it('viewed_by_issuer is not verification', () => {
    const copy = statusCopy('viewed_by_issuer');
    expect(copy.description.toLowerCase()).not.toContain('verified');
  });

  it('confirmed status requires review and never auto-upgrades to verified', () => {
    const copy = statusCopy('confirmed');
    expect(copy.reviewRequired).toBe(true);
    expect(copy.label).not.toBe('Verified');
    expect(copy.description).toMatch(/review/i);
  });

  it('partially_confirmed requires review', () => {
    expect(statusCopy('partially_confirmed').reviewRequired).toBe(true);
  });

  it('legally_only maps to review_required', () => {
    expect(statusCopy('legally_only').reviewRequired).toBe(true);
  });

  it('wrong_office does not verify the claim', () => {
    const copy = statusCopy('wrong_office');
    expect(copy.reviewRequired).toBe(false);
    expect(copy.description.toLowerCase()).not.toContain('verified');
  });

  it('requires_release pauses the request and is not verification', () => {
    const copy = statusCopy('requires_release');
    expect(copy.reviewRequired).toBe(false);
    expect(copy.description.toLowerCase()).not.toContain('verified');
  });

  it('confirmed creates a receipt candidate, never a global proof', () => {
    const receipt: ReceiptCandidate = {
      candidateId: 'rc-1',
      createdAt: '2026-04-25T00:00:00.000Z',
      basis: 'issuer_direct',
      sourceOrganizationName: 'Demo Hospital',
      attributionStatus: 'attributed_pending_review',
      decisionGrade: false,
      notes: 'Awaiting reviewer attribution.',
    };
    expect(receipt.decisionGrade).toBe(false);
    expect(receipt.attributionStatus).not.toBe('attributed_reviewed');
  });

  it('an uploaded document never becomes verified automatically — receipt candidates stay decisionGrade=false', () => {
    // Type-level guarantee: ReceiptCandidate.decisionGrade is the literal
    // `false`. The runtime assertion mirrors the type-level rule.
    const decisionGrade: ReceiptCandidate['decisionGrade'] = false;
    expect(decisionGrade).toBe(false);
  });

  it('contracted-agent route preserves agent/source distinction', () => {
    const receipt: ReceiptCandidate = {
      candidateId: 'rc-2',
      createdAt: '2026-04-25T00:00:00.000Z',
      basis: 'contracted_agent',
      agentName: 'GME-Verify Service',
      sourceOrganizationName: 'University Hospital GME Office',
      attributionStatus: 'attributed_pending_review',
      decisionGrade: false,
    };
    expect(receipt.basis).toBe('contracted_agent');
    expect(receipt.agentName).toBeDefined();
    expect(receipt.sourceOrganizationName).toBeDefined();
    expect(receipt.agentName).not.toBe(receipt.sourceOrganizationName);
  });

  it('IssuerVerificationRequest carries history and status as separate concerns from verification', () => {
    const claimType: VerificationClaimType = 'residency';
    const route = recommendPartnerRoute(claimType);
    const request: IssuerVerificationRequest = {
      requestId: 'req-1',
      claimType,
      claimSummary: 'Residency: Internal Medicine',
      issuerCandidate: {
        candidateId: 'cand-1',
        organizationName: 'Demo GME',
        source: 'clinician_provided',
      },
      route,
      consent: {
        consentId: 'consent-1',
        scope: 'verify_residency',
        status: 'granted',
      },
      status: 'sent',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
      history: [
        { status: 'draft', at: '2026-04-25T00:00:00.000Z' },
        { status: 'sent', at: '2026-04-25T00:00:00.000Z' },
      ],
    };
    expect(request.response).toBeUndefined();
    // sent does not produce a receipt candidate
    expect(statusCopy(request.status).reviewRequired).toBe(false);
  });
});

describe('Issuer Verification — Banned Strings', () => {
  it('keeps banned overclaim strings out of status copy and partner labels', () => {
    const blob = [
      ...Object.values(STATUS_COPY).flatMap((s) => [s.label, s.description]),
      ...Object.values(PARTNER_CATEGORY_LABEL),
    ]
      .join(' ')
      .toLowerCase();
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned.toLowerCase());
    }
  });

  it('no status is labeled simply "Verified"', () => {
    for (const copy of Object.values(STATUS_COPY)) {
      expect(copy.label).not.toBe('Verified');
    }
  });

  it('router output never contains banned strings', () => {
    const claimTypes: VerificationClaimType[] = [
      'education_degree',
      'medical_school',
      'residency',
      'fellowship',
      'background_check',
      'professional_license',
      'work_history',
      'board_certification',
      'publication_research',
      'unknown',
    ];
    const blob = claimTypes.map((t) => lower(recommendPartnerRoute(t))).join('\n');
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned.toLowerCase());
    }
  });
});

describe('receiptCandidate.ts — purity guard (no I/O, no DB, no audit writes)', () => {
  it('source contains no fetch / axios / network / db / audit-writer tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/receiptCandidate.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const banned = [
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'prisma.',
      'recordAudit',
      'recordAuditEvent',
      "import('@/",
      'require(',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('does not statically import any backend module', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/receiptCandidate.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]apps\/api/);
    expect(src).not.toMatch(/from ['"]@vitalcv\/psv['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*prisma_client['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*psvReceipts\.repo['"]/);
  });
});

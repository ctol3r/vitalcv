/**
 * ENTERPRISE-VANGUARD-6A — enterprise foundation tests.
 *
 * Truth invariants enforced:
 *   - Redaction, retention, authority adapters, compliance reporting, and
 *     superadmin gating are foundation shapes only.
 *   - California authority lookup is a stub and performs no live lookup.
 *   - Compliance evidence reports planned controls with explicit non-live
 *     flags and does not claim certifications or guarantees.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { californiaMedicalBoardAdapter, CaliforniaMedicalBoardAdapter } from '../../lib/authority/californiaAdapter';
import {
  buildAdapterMatrix,
  getAdapterForState,
  type AuthorityAdapterCapability,
} from '../../lib/authority/adapterMatrix';
import {
  buildDataClassificationFoundation,
  classifyField,
  explainClassification,
  maskValue,
  REDACTION_RULES,
  type DataClassification,
} from '../../lib/security/dataClassificationFoundation';
import {
  buildRetentionFoundation,
  DEFAULT_RETENTION_POLICIES,
  explainRetentionPolicy,
  getPolicyForEntity,
  type RetentionEntityType,
} from '../../lib/security/retentionFoundation';
import { GET } from '../../app/api/compliance/evidence/route';

const WEB_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(WEB_ROOT, '../..');

const requiredRedactionFields = [
  'ssn',
  'dob',
  'contactEmail',
  'phoneNumber',
  'homeAddress',
  'deviceFingerprint',
] as const;

const retentionEntities: RetentionEntityType[] = [
  'audit_event',
  'application_snapshot',
  'source_check_result',
  'session_token',
  'clinician_profile',
];

describe('data classification foundation', () => {
  const foundation = buildDataClassificationFoundation();

  it('keeps all live-control flags false', () => {
    expect(foundation.redactionLive).toBe(false);
    expect(foundation.piiTierDocLive).toBe(false);
    expect(foundation.retentionPolicyLive).toBe(false);
  });

  it('defines exactly the six required redaction rules', () => {
    expect(REDACTION_RULES).toHaveLength(6);
    expect(REDACTION_RULES.map((rule) => rule.field)).toEqual([...requiredRedactionFields]);
  });

  it('classifies ssn as pii', () => {
    expect(classifyField('ssn')).toBe('pii');
  });

  it('classifies dob as pii', () => {
    expect(classifyField('dob')).toBe('pii');
  });

  it('classifies contactEmail as pii', () => {
    expect(classifyField('contactEmail')).toBe('pii');
  });

  it('classifies phoneNumber as pii', () => {
    expect(classifyField('phoneNumber')).toBe('pii');
  });

  it('classifies homeAddress as pii', () => {
    expect(classifyField('homeAddress')).toBe('pii');
  });

  it('classifies deviceFingerprint as internal', () => {
    expect(classifyField('deviceFingerprint')).toBe('internal');
  });

  it('classifies unknown public fields conservatively as public', () => {
    expect(classifyField('displaySpecialty')).toBe('public');
  });

  it('classifies health-condition-like fields as phi', () => {
    expect(classifyField('treatmentCondition')).toBe('phi');
  });

  it('masks ssn to last-four format without returning the raw value', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'ssn');
    expect(rule).toBeDefined();

    const masked = maskValue('123-45-6789', rule!);
    expect(masked).toBe('***-**-6789');
    expect(masked).not.toBe('123-45-6789');
  });

  it('masks dob without returning the raw date', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'dob');
    expect(rule).toBeDefined();

    const masked = maskValue('04/30/1980', rule!);
    expect(masked).toBe('**/**/1980');
    expect(masked).not.toBe('04/30/1980');
  });

  it('masks contactEmail by withholding the mailbox', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'contactEmail');
    expect(rule).toBeDefined();

    const masked = maskValue('clinician@example.com', rule!);
    expect(masked).toBe('***@example.com');
    expect(masked).not.toContain('clinician');
  });

  it('masks phoneNumber to last-four format', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'phoneNumber');
    expect(rule).toBeDefined();

    const masked = maskValue('(415) 555-1212', rule!);
    expect(masked).toBe('***-***-1212');
    expect(masked).not.toContain('415');
  });

  it('masks homeAddress without leaking the street value', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'homeAddress');
    expect(rule).toBeDefined();

    const masked = maskValue('10 Market Street', rule!);
    expect(masked).toBe('[address redacted]');
    expect(masked).not.toContain('Market');
  });

  it('masks deviceFingerprint as internal risk telemetry', () => {
    const rule = REDACTION_RULES.find((candidate) => candidate.field === 'deviceFingerprint');
    expect(rule).toBeDefined();

    const masked = maskValue('fingerprint-abc-123', rule!);
    expect(masked).toBe('[device fingerprint withheld]');
    expect(masked).not.toContain('abc');
  });

  it('explains every classification without blanket guarantees', () => {
    const classifications: DataClassification[] = ['public', 'pii', 'phi', 'internal'];
    for (const classification of classifications) {
      const explanation = explainClassification(classification).toLowerCase();
      expect(explanation.length).toBeGreaterThan(0);
      expect(explanation).not.toContain(['guaranteed', 'redaction'].join(' '));
    }
  });
});

describe('retention foundation', () => {
  const foundation = buildRetentionFoundation();

  it('keeps retention automation flags false', () => {
    expect(foundation.retentionEnforced).toBe(false);
    expect(foundation.autoDeleteLive).toBe(false);
    expect(foundation.retentionCronLive).toBe(false);
  });

  it('defines the five required default policies', () => {
    expect(DEFAULT_RETENTION_POLICIES).toHaveLength(5);
    expect(DEFAULT_RETENTION_POLICIES.map((policy) => policy.entityType)).toEqual(retentionEntities);
  });

  it('returns a policy for every required entity type', () => {
    for (const entity of retentionEntities) {
      expect(getPolicyForEntity(entity)).toBeDefined();
    }
  });

  it('sets audit_event retention to 2555 days', () => {
    expect(getPolicyForEntity('audit_event')?.retentionDays).toBe(2555);
  });

  it('sets application_snapshot retention to 2555 days', () => {
    expect(getPolicyForEntity('application_snapshot')?.retentionDays).toBe(2555);
  });

  it('sets source_check_result retention to 365 days', () => {
    expect(getPolicyForEntity('source_check_result')?.retentionDays).toBe(365);
  });

  it('sets session_token retention to 30 days', () => {
    expect(getPolicyForEntity('session_token')?.retentionDays).toBe(30);
  });

  it('sets clinician_profile retention to 2555 days', () => {
    expect(getPolicyForEntity('clinician_profile')?.retentionDays).toBe(2555);
  });

  it('marks session_token as not requiring manual review', () => {
    expect(getPolicyForEntity('session_token')?.requiresManualReview).toBe(false);
  });

  it('explains retention as planned and not a positive production control', () => {
    const policy = getPolicyForEntity('audit_event');
    expect(policy).toBeDefined();

    const explanation = explainRetentionPolicy(policy!).toLowerCase();
    expect(explanation).toContain('planned');
    expect(explanation).toContain('not enforced');
    expect(explanation).not.toContain(['is', 'enforced', 'today'].join(' '));
  });
});

describe('authority adapter matrix', () => {
  const matrix = buildAdapterMatrix();

  it('keeps allAdaptersLive false', () => {
    expect(matrix.allAdaptersLive).toBe(false);
  });

  it('includes the California Medical Board adapter', () => {
    expect(matrix.adapters).toHaveLength(1);
    expect(matrix.adapters[0]).toBe(californiaMedicalBoardAdapter);
  });

  it('finds the California adapter by state', () => {
    const adapter = getAdapterForState('CA');
    expect(adapter).toBeInstanceOf(CaliforniaMedicalBoardAdapter);
    expect(adapter?.adapterId).toBe('ca-medical-board');
  });

  it('finds adapters case-insensitively by state', () => {
    expect(getAdapterForState('ca')).toBe(californiaMedicalBoardAdapter);
  });

  it('keeps every adapter isLive=false', () => {
    for (const adapter of matrix.adapters) {
      expect(adapter.isLive).toBe(false);
      expect(adapter.status).not.toBe('live');
    }
  });

  it('exposes the required planned capabilities for California', () => {
    const required: AuthorityAdapterCapability[] = [
      'verify_license',
      'check_disciplinary',
      'get_expiration',
      'get_limitations',
      'check_npi_match',
    ];
    for (const capability of required) {
      expect(californiaMedicalBoardAdapter.capabilities).toContain(capability);
    }
  });

  it('returns undefined for an unmodeled state', () => {
    expect(getAdapterForState('NY')).toBeUndefined();
  });
});

describe('California Medical Board adapter stub', () => {
  it('declares stub status and non-live typed literal', () => {
    expect(californiaMedicalBoardAdapter.adapterId).toBe('ca-medical-board');
    expect(californiaMedicalBoardAdapter.authorityName).toBe('California Medical Board');
    expect(californiaMedicalBoardAdapter.state).toBe('CA');
    expect(californiaMedicalBoardAdapter.status).toBe('stub');
    expect(californiaMedicalBoardAdapter.isLive).toBe(false);
  });

  it('returns an honest planned stub for checkLicenseStatus', async () => {
    const result = await californiaMedicalBoardAdapter.checkLicenseStatus('1234567890');
    expect(result).toEqual({
      found: false,
      active: null,
      reason: 'CaliforniaMedicalBoard API is not connected. This is a planned integration stub.',
    });
  });

  it('returns an honest planned stub for checkDisciplinaryActions', async () => {
    const result = await californiaMedicalBoardAdapter.checkDisciplinaryActions('1234567890');
    expect(result).toEqual({
      hasActions: null,
      reason: 'Disciplinary action lookup is not implemented. This is a planned integration stub.',
    });
  });

  it('returns an honest planned stub for getExpirationDate', async () => {
    const result = await californiaMedicalBoardAdapter.getExpirationDate('1234567890');
    expect(result).toEqual({
      expiresAt: null,
      reason: 'License expiration lookup is not connected. This is a planned integration stub.',
    });
  });

  it('returns an honest planned stub for getLimitations', async () => {
    const result = await californiaMedicalBoardAdapter.getLimitations('1234567890');
    expect(result).toEqual({
      limitations: [],
      reason: 'Limitations lookup is not connected. This is a planned integration stub.',
    });
  });

  it('does not claim live authority data in any stub method reason', async () => {
    const results = [
      await californiaMedicalBoardAdapter.checkLicenseStatus('1234567890'),
      await californiaMedicalBoardAdapter.checkDisciplinaryActions('1234567890'),
      await californiaMedicalBoardAdapter.getExpirationDate('1234567890'),
      await californiaMedicalBoardAdapter.getLimitations('1234567890'),
    ];

    for (const result of results) {
      const reason = result.reason.toLowerCase();
      expect(reason).toContain('stub');
      expect(reason).not.toContain('live data');
      expect(reason).not.toContain('verified by california');
    }
  });
});

describe('compliance evidence route', () => {
  it('returns 200 without a request auth gate in this foundation', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('returns the required foundation response shape', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toMatchObject({
      superadminGateLive: false,
      complianceReportLive: false,
      reportScope: 'enterprise-vanguard-6a-foundation',
      dataClassification: {
        redactionLive: false,
        ruleCount: 6,
      },
      retention: {
        retentionEnforced: false,
        policyCount: 5,
      },
      authority: {
        allAdaptersLive: false,
        adapterCount: 1,
      },
      disclaimer:
        'This report is a foundation shape for vendor risk assessments. It reflects planned controls, not enforced production policies.',
    });
  });

  it('uses an ISO generatedAt timestamp', async () => {
    const response = await GET();
    const payload = await response.json();
    expect(Date.parse(payload.generatedAt)).not.toBeNaN();
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('documents the missing superadmin gate explicitly', async () => {
    const response = await GET();
    const payload = await response.json();
    expect(payload.superadminGateLive).toBe(false);
  });

  it('does not make certification or guarantee claims in the response text', async () => {
    const response = await GET();
    const payload = await response.json();
    const text = JSON.stringify(payload).toLowerCase();
    const banned = [
      ['hipaa', 'compliant'],
      ['soc2', 'certified'],
      ['pii', 'is', 'guaranteed'],
      ['tamper', '-proof'],
      ['legally', 'approved'],
    ].map((parts) => parts.join(parts[1] === '-proof' ? '' : ' '));

    for (const phrase of banned) {
      expect(text).not.toContain(phrase);
    }
    expect(text).not.toContain(['controls', 'are', 'enforced'].join(' '));
  });
});

describe('enterprise vanguard banned phrase regression', () => {
  const newFiles = [
    'apps/web/lib/security/dataClassificationFoundation.ts',
    'apps/web/lib/security/retentionFoundation.ts',
    'apps/web/lib/authority/adapterMatrix.ts',
    'apps/web/lib/authority/californiaAdapter.ts',
    'apps/web/app/api/compliance/evidence/route.ts',
    'apps/web/__tests__/enterprise-vanguard/enterprise-vanguard-6.test.ts',
    'docs/ops/vitalcv-completion-board.md',
  ];

  it('does not contain banned positive-claim phrases across new files', () => {
    const banned = [
      ['hipaa', 'compliant'],
      ['soc2', 'certified'],
      ['always', 'redacted'],
      ['enforced', 'by', 'this'],
      ['CaliforniaMedicalBoard', 'API', 'is', 'connected'],
      ['pii', 'is', 'guaranteed'],
      ['tamper', '-proof'],
      ['legally', 'approved'],
    ].map((parts) => parts.join(parts[1] === '-proof' ? '' : ' '));

    for (const file of newFiles) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf-8').toLowerCase();
      for (const phrase of banned) {
        expect(source).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

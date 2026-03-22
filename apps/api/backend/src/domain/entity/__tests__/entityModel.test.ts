/**
 * entityModel.test.ts — Entity-Role-Relationship Model Tests
 *
 * Validates:
 *   - NPI type classification
 *   - Entity type routing rules
 *   - Role eligibility enforcement
 *   - Relationship triple validation
 *   - Workflow context routing
 *   - Education domain constants
 */

import {
  NPI_TYPE_ROUTING,
  ROLE_ELIGIBILITY,
  RELATIONSHIP_RULES,
  WORKFLOW_ROUTING,
  ENTITY_ROLE_PATTERNS,
  EDUCATION_ISSUERS,
  CANONICAL_ISSUERS,
  EDUCATION_READINESS_RULES,
} from '../types';

import {
  isValidNpi,
  classifyEnumerationType,
  deriveCanonicalId,
  buildEntityFromNppesRecord,
  canAssignRole,
  isValidRelationship,
} from '../npiRouter';

import {
  resolveWorkflowContext,
  contextsForRole,
  contextsForEntityType,
  isActionPermitted,
} from '../workflowContext';
import type { RoleType } from '../types';

// ── NPI validation ───────────────────────────────────────────

describe('isValidNpi', () => {
  it('accepts a 10-digit NPI', () => {
    expect(isValidNpi('1234567890')).toBe(true);
    expect(isValidNpi('0000000000')).toBe(true);
  });
  it('rejects non-10-digit strings', () => {
    expect(isValidNpi('123456789')).toBe(false);   // 9 digits
    expect(isValidNpi('12345678901')).toBe(false);  // 11 digits
    expect(isValidNpi('123456789a')).toBe(false);   // non-numeric
    expect(isValidNpi('')).toBe(false);
  });
});

// ── NPI type classification ──────────────────────────────────

describe('classifyEnumerationType', () => {
  it('maps NPI-1 to TYPE_1', () => {
    expect(classifyEnumerationType('NPI-1')).toBe('TYPE_1');
  });
  it('maps NPI-2 to TYPE_2', () => {
    expect(classifyEnumerationType('NPI-2')).toBe('TYPE_2');
  });
  it('defaults to TYPE_1 for undefined', () => {
    expect(classifyEnumerationType(undefined)).toBe('TYPE_1');
  });
});

// ── NPI type routing ─────────────────────────────────────────

describe('NPI_TYPE_ROUTING', () => {
  it('TYPE_1 routes to person entity and prove_readiness context', () => {
    const rule = NPI_TYPE_ROUTING['TYPE_1'];
    expect(rule.entityType).toBe('person');
    expect(rule.primaryRoles).toContain('clinician');
    expect(rule.workflowContext).toBe('prove_readiness');
    expect(rule.identityAnchor).toBe('PERSON_NAME');
  });

  it('TYPE_2 routes to organization entity and review_clinician context', () => {
    const rule = NPI_TYPE_ROUTING['TYPE_2'];
    expect(rule.entityType).toBe('organization');
    expect(rule.primaryRoles).toContain('employer');
    expect(rule.workflowContext).toBe('review_clinician');
    expect(rule.identityAnchor).toBe('ORG_NAME');
  });
});

// ── Canonical ID ─────────────────────────────────────────────

describe('deriveCanonicalId', () => {
  it('is deterministic for the same inputs', () => {
    const a = deriveCanonicalId('person', '1234567890');
    const b = deriveCanonicalId('person', '1234567890');
    expect(a).toBe(b);
  });
  it('differs for different entity types with same primary key', () => {
    const person = deriveCanonicalId('person', '1234567890');
    const org    = deriveCanonicalId('organization', '1234567890');
    expect(person).not.toBe(org);
  });
  it('produces a 32-char hex string', () => {
    const id = deriveCanonicalId('person', 'test');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ── Entity from NPPES record ─────────────────────────────────

describe('buildEntityFromNppesRecord', () => {
  const npi1Record = {
    number: '1003000126',
    enumeration_type: 'NPI-1',
    basic: {
      first_name: 'John',
      last_name:  'Smith',
      credential: 'MD',
      status:     'A',
    },
    taxonomies: [
      { code: '207Q00000X', desc: 'Family Medicine', primary: true, state: 'CA', license: 'G12345' },
    ],
    addresses: [
      { address_purpose: 'PRACTICE', address_1: '100 Main St', city: 'Los Angeles', state: 'CA', postal_code: '90001', country_code: 'US' },
    ],
  };

  it('builds a person entity from NPI-1 record', () => {
    const entity = buildEntityFromNppesRecord(npi1Record);
    expect(entity.entityType).toBe('person');
    expect(entity.npiType).toBe('TYPE_1');
    expect(entity.npi).toBe('1003000126');
    expect(entity.displayName).toContain('John');
    expect(entity.displayName).toContain('Smith');
    expect(entity.metadata.credential).toBe('MD');
    expect(entity.metadata.taxonomies).toHaveLength(1);
  });

  const npi2Record = {
    number: '1234567891',
    enumeration_type: 'NPI-2',
    basic: {
      organization_name: 'Kaiser Permanente Medical Group',
      status: 'A',
    },
    taxonomies: [],
    addresses: [],
  };

  it('builds an organization entity from NPI-2 record', () => {
    const entity = buildEntityFromNppesRecord(npi2Record);
    expect(entity.entityType).toBe('organization');
    expect(entity.npiType).toBe('TYPE_2');
    expect(entity.displayName).toContain('Kaiser');
    expect(entity.metadata.orgName).toContain('Kaiser');
  });
});

// ── Role eligibility ─────────────────────────────────────────

describe('ROLE_ELIGIBILITY', () => {
  it('clinician is only eligible for person entities', () => {
    expect(ROLE_ELIGIBILITY['clinician']).toContain('person');
    expect(ROLE_ELIGIBILITY['clinician']).not.toContain('organization');
  });
  it('employer is eligible for organization and facility', () => {
    expect(ROLE_ELIGIBILITY['employer']).toContain('organization');
    expect(ROLE_ELIGIBILITY['employer']).toContain('facility');
  });
  it('issuer is eligible for issuer_authority and organization', () => {
    expect(ROLE_ELIGIBILITY['issuer']).toContain('issuer_authority');
    expect(ROLE_ELIGIBILITY['issuer']).toContain('organization');
  });
  it('trainee is only eligible for person', () => {
    expect(ROLE_ELIGIBILITY['trainee']).toContain('person');
    expect(ROLE_ELIGIBILITY['trainee']).not.toContain('organization');
  });
});

describe('canAssignRole', () => {
  it('allows clinician role for person', () => {
    expect(canAssignRole('person', 'clinician')).toBe(true);
  });
  it('denies clinician role for organization', () => {
    expect(canAssignRole('organization', 'clinician')).toBe(false);
  });
  it('allows employer role for organization', () => {
    expect(canAssignRole('organization', 'employer')).toBe(true);
  });
  it('allows employer role for facility', () => {
    expect(canAssignRole('facility', 'employer')).toBe(true);
  });
  it('allows issuer role for issuer_authority', () => {
    expect(canAssignRole('issuer_authority', 'issuer')).toBe(true);
  });
});

// ── Relationship validation ──────────────────────────────────

describe('isValidRelationship', () => {
  it('allows person → LICENSED_BY → issuer_authority', () => {
    expect(isValidRelationship('person', 'licensed_by', 'issuer_authority')).toBe(true);
  });
  it('allows person → TRAINED_AT → training_program', () => {
    expect(isValidRelationship('person', 'trained_at', 'training_program')).toBe(true);
  });
  it('allows person → WORKS_FOR → organization', () => {
    expect(isValidRelationship('person', 'works_for', 'organization')).toBe(true);
  });
  it('allows person → SHARES_WITH → organization', () => {
    expect(isValidRelationship('person', 'shares_with', 'organization')).toBe(true);
  });
  it('denies organization → LICENSED_BY → issuer_authority (orgs are not licensed)', () => {
    expect(isValidRelationship('organization', 'licensed_by', 'issuer_authority')).toBe(false);
  });
  it('denies person → WORKS_FOR → issuer_authority', () => {
    expect(isValidRelationship('person', 'works_for', 'issuer_authority')).toBe(false);
  });
  it('denies person → SPONSORS → person (sponsors org/program, not person)', () => {
    // Per RELATIONSHIP_RULES: sponsors goes org → program, not person → person
    expect(isValidRelationship('person', 'sponsors', 'person')).toBe(false);
  });
});

// ── Workflow context routing ──────────────────────────────────

describe('resolveWorkflowContext', () => {
  const npi1Resolution = {
    npi:             '1234567890',
    npiType:         'TYPE_1' as const,
    enumerationType: 'NPI-1' as const,
    entityType:      'person' as const,
    suggestedRoles:  ['clinician'] as RoleType[],
    routingContext:  'prove_readiness' as const,
    displayName:     'John Smith, MD',
    status:          'ACTIVE' as const,
    source:          'NPPES_API' as const,
    resolvedAt:      new Date().toISOString(),
  };

  const npi2Resolution = {
    ...npi1Resolution,
    npi:             '1234567891',
    npiType:         'TYPE_2' as const,
    enumerationType: 'NPI-2' as const,
    entityType:      'organization' as const,
    suggestedRoles:  ['employer'] as RoleType[],
    routingContext:  'review_clinician' as const,
    displayName:     'Kaiser Permanente',
  };

  it('routes TYPE_1 NPI to prove_readiness by default', () => {
    const result = resolveWorkflowContext(npi1Resolution);
    expect(result.context).toBe('prove_readiness');
    expect(result.primarySurface).toBe('/get-ready');
    expect(result.valid).toBe(true);
  });

  it('routes TYPE_2 NPI to review_clinician by default', () => {
    const result = resolveWorkflowContext(npi2Resolution);
    expect(result.context).toBe('review_clinician');
    expect(result.primarySurface).toBe('/verifier/inbox');
    expect(result.valid).toBe(true);
  });

  it('accepts an explicit context override when entity is eligible', () => {
    const result = resolveWorkflowContext(npi2Resolution, 'monitor_standing');
    expect(result.context).toBe('monitor_standing');
    expect(result.valid).toBe(true);
  });

  it('returns validation error when entity is not eligible for requested context', () => {
    // organization (employer) requesting prove_readiness (clinician context)
    const result = resolveWorkflowContext(npi2Resolution, 'prove_readiness');
    expect(result.valid).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });
});

describe('contextsForRole', () => {
  it('clinician appears in prove_readiness and monitor_standing', () => {
    const ctxs = contextsForRole('clinician');
    expect(ctxs).toContain('prove_readiness');
    expect(ctxs).toContain('monitor_standing');
  });
  it('employer appears in review_clinician and monitor_standing', () => {
    const ctxs = contextsForRole('employer');
    expect(ctxs).toContain('review_clinician');
    expect(ctxs).toContain('monitor_standing');
  });
  it('issuer appears in issue_credential', () => {
    const ctxs = contextsForRole('issuer');
    expect(ctxs).toContain('issue_credential');
  });
});

describe('isActionPermitted', () => {
  it('submit_npi is permitted in prove_readiness', () => {
    expect(isActionPermitted('submit_npi', 'prove_readiness')).toBe(true);
  });
  it('submit_npi is NOT permitted in review_clinician', () => {
    expect(isActionPermitted('submit_npi', 'review_clinician')).toBe(false);
  });
  it('issue_credential is permitted in issue_credential context', () => {
    expect(isActionPermitted('issue_credential', 'issue_credential')).toBe(true);
  });
  it('revoke_credential is NOT permitted in prove_readiness', () => {
    expect(isActionPermitted('revoke_credential', 'prove_readiness')).toBe(false);
  });
});

// ── Education domain ─────────────────────────────────────────

describe('EDUCATION_ISSUERS', () => {
  it('ACGME covers residency and fellowship completion', () => {
    expect(EDUCATION_ISSUERS.ACGME.credentialTypes).toContain('RESIDENCY_COMPLETION');
    expect(EDUCATION_ISSUERS.ACGME.credentialTypes).toContain('FELLOWSHIP_COMPLETION');
  });
  it('LCME covers medical degrees', () => {
    expect(EDUCATION_ISSUERS.LCME.credentialTypes).toContain('MEDICAL_DEGREE');
  });
  it('all education issuers are typed as issuer_authority', () => {
    Object.values(EDUCATION_ISSUERS).forEach(issuer => {
      expect(issuer.type).toBe('issuer_authority');
    });
  });
});

describe('EDUCATION_READINESS_RULES', () => {
  it('MEDICAL_DEGREE is required and blocks if missing', () => {
    const rule = EDUCATION_READINESS_RULES.find(r => r.claimType === 'MEDICAL_DEGREE');
    expect(rule?.required).toBe(true);
    expect(rule?.blockingIfMissing).toBe(true);
    expect(rule?.freshnessWindowDays).toBeNull();  // permanent once issued
  });
  it('CME_COMPLETION has a 365-day freshness window', () => {
    const rule = EDUCATION_READINESS_RULES.find(r => r.claimType === 'CME_COMPLETION');
    expect(rule?.freshnessWindowDays).toBe(365);
  });
});

// ── Canonical issuers completeness ───────────────────────────

describe('CANONICAL_ISSUERS', () => {
  it('includes the three sources in the 24h sprint', () => {
    expect(CANONICAL_ISSUERS.CMS_NPPES).toBeDefined();
    expect(CANONICAL_ISSUERS.OIG_LEIE).toBeDefined();
    expect(CANONICAL_ISSUERS.CMS_PECOS).toBeDefined();
  });
  it('DEA and NPDB are registered', () => {
    expect(CANONICAL_ISSUERS.DEA).toBeDefined();
    expect(CANONICAL_ISSUERS.NPDB).toBeDefined();
  });
  it('all issuers have an id, name, and jurisdiction', () => {
    Object.values(CANONICAL_ISSUERS).forEach(issuer => {
      expect(issuer.id).toBeTruthy();
      expect(issuer.name).toBeTruthy();
      expect(issuer.jurisdiction).toBeTruthy();
    });
  });
});

// ── Entity role patterns ──────────────────────────────────────

describe('ENTITY_ROLE_PATTERNS', () => {
  it('clinician_employer_issuer pattern exists', () => {
    const pattern = ENTITY_ROLE_PATTERNS.find(p => p.label === 'clinician_employer_issuer');
    expect(pattern).toBeDefined();
    expect(pattern?.roles).toContain('clinician');
    expect(pattern?.roles).toContain('employer');
    expect(pattern?.roles).toContain('issuer');
  });
  it('trainee pattern includes both trainee and clinician roles', () => {
    const pattern = ENTITY_ROLE_PATTERNS.find(p => p.label === 'trainee');
    expect(pattern?.roles).toContain('trainee');
    expect(pattern?.roles).toContain('clinician');
  });
  it('all patterns reference at least one valid workflow context', () => {
    const validContexts = Object.keys(WORKFLOW_ROUTING);
    ENTITY_ROLE_PATTERNS.forEach(p => {
      p.contexts.forEach(ctx => {
        expect(validContexts).toContain(ctx);
      });
    });
  });
});

/**
 * ENTERPRISE-VANGUARD-6A — data classification and redaction foundation.
 *
 * Truth invariants:
 *   1. Redaction is modeled here only. `redactionLive: false` keeps this
 *      module out of the request/response path.
 *   2. The PII tier doc and retention policy are not production controls in
 *      this foundation. They are represented as typed flags for downstream UI
 *      and vendor-risk reporting.
 *   3. Classification explanations describe handling intent. They do not
 *      guarantee that a live interceptor has transformed every payload.
 */

export type DataClassification = 'public' | 'pii' | 'phi' | 'internal';

export interface RedactionRule {
  field: string;
  classification: DataClassification;
  maskWith: string;
  description: string;
}

export interface DataClassificationFoundation {
  redactionLive: false;
  piiTierDocLive: false;
  retentionPolicyLive: false;
  rules: ReadonlyArray<RedactionRule>;
}

export const REDACTION_RULES: ReadonlyArray<RedactionRule> = [
  {
    field: 'ssn',
    classification: 'pii',
    maskWith: '***-**-####',
    description: 'Social Security number should be masked to last four digits in planned operator surfaces.',
  },
  {
    field: 'dob',
    classification: 'pii',
    maskWith: '**/**/####',
    description: 'Date of birth should be masked to year unless a verified reviewer needs the full value.',
  },
  {
    field: 'contactEmail',
    classification: 'pii',
    maskWith: '***@domain',
    description: 'Contact email should expose domain context without showing the full mailbox.',
  },
  {
    field: 'phoneNumber',
    classification: 'pii',
    maskWith: '***-***-####',
    description: 'Phone number should be masked to last four digits for non-reviewer displays.',
  },
  {
    field: 'homeAddress',
    classification: 'pii',
    maskWith: '[address redacted]',
    description: 'Home address should be hidden from routine operator views.',
  },
  {
    field: 'deviceFingerprint',
    classification: 'internal',
    maskWith: '[device fingerprint withheld]',
    description: 'Device fingerprint is internal risk telemetry and should not be shown as a user identity claim.',
  },
] as const;

export function buildDataClassificationFoundation(): DataClassificationFoundation {
  return {
    redactionLive: false,
    piiTierDocLive: false,
    retentionPolicyLive: false,
    rules: REDACTION_RULES,
  };
}

export function classifyField(fieldName: string): DataClassification {
  const normalized = fieldName.trim().toLowerCase();
  const rule = REDACTION_RULES.find((candidate) => candidate.field.toLowerCase() === normalized);
  if (rule) return rule.classification;

  if (normalized.includes('diagnosis') || normalized.includes('condition') || normalized.includes('treatment')) {
    return 'phi';
  }

  if (
    normalized.includes('email') ||
    normalized.includes('phone') ||
    normalized.includes('address') ||
    normalized.includes('name') ||
    normalized.includes('birth') ||
    normalized.includes('ssn')
  ) {
    return 'pii';
  }

  if (
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('fingerprint') ||
    normalized.includes('session')
  ) {
    return 'internal';
  }

  return 'public';
}

export function maskValue(value: string, rule: RedactionRule): string {
  if (value.length === 0) return '';

  switch (rule.field) {
    case 'ssn': {
      const digits = value.replace(/\D/g, '');
      const lastFour = digits.slice(-4).padStart(4, '*');
      return `***-**-${lastFour}`;
    }
    case 'dob': {
      const year = value.match(/\b(\d{4})\b/)?.[1] ?? value.slice(-4).padStart(4, '*');
      return `**/**/${year}`;
    }
    case 'contactEmail': {
      const domain = value.split('@')[1];
      return domain ? `***@${domain}` : '***';
    }
    case 'phoneNumber': {
      const digits = value.replace(/\D/g, '');
      const lastFour = digits.slice(-4).padStart(4, '*');
      return `***-***-${lastFour}`;
    }
    case 'homeAddress':
      return '[address redacted]';
    case 'deviceFingerprint':
      return '[device fingerprint withheld]';
    default:
      return rule.maskWith;
  }
}

export function explainClassification(classification: DataClassification): string {
  switch (classification) {
    case 'public':
      return 'Public data may be shown in product surfaces when it is source-backed or user-supplied with context.';
    case 'pii':
      return 'PII requires planned masking, access review, and audit context before broad operator exposure.';
    case 'phi':
      return 'PHI requires the strictest handling path and is outside routine foundation reporting.';
    case 'internal':
      return 'Internal data supports risk, security, or operations workflows and should not be presented as clinician proof.';
  }
}

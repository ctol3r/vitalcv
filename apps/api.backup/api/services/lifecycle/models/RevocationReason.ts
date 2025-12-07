/**
 * B238B-LIFE-013: RevocationReason taxonomy
 *
 * Enum or model defining standard revocation reasons (fraud, misrepresentation,
 * voluntary, organisational policy); enables consistent logging and reporting.
 */

import { z } from 'zod';

/**
 * Standard revocation reasons for credentials
 */
export enum RevocationReason {
  // Fraud-related
  FRAUD = 'FRAUD',
  IDENTITY_THEFT = 'IDENTITY_THEFT',
  FORGERY = 'FORGERY',

  // Misrepresentation
  MISREPRESENTATION = 'MISREPRESENTATION',
  FALSE_CLAIMS = 'FALSE_CLAIMS',
  DOCUMENT_FALSIFICATION = 'DOCUMENT_FALSIFICATION',

  // Voluntary
  VOLUNTARY = 'VOLUNTARY',
  RESIGNATION = 'RESIGNATION',
  RETIREMENT = 'RETIREMENT',

  // Organisational policy
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  CODE_OF_CONDUCT_VIOLATION = 'CODE_OF_CONDUCT_VIOLATION',
  COMPLIANCE_FAILURE = 'COMPLIANCE_FAILURE',

  // Professional misconduct
  PROFESSIONAL_MISCONDUCT = 'PROFESSIONAL_MISCONDUCT',
  DISCIPLINARY_ACTION = 'DISCIPLINARY_ACTION',
  LICENSE_REVOCATION = 'LICENSE_REVOCATION',

  // Administrative
  EXPIRATION = 'EXPIRATION',
  NON_RENEWAL = 'NON_RENEWAL',
  ADMINISTRATIVE_ERROR = 'ADMINISTRATIVE_ERROR',

  // Other
  OTHER = 'OTHER',
}

/**
 * Schema for revocation reason with optional details
 */
export const RevocationReasonSchema = z.object({
  reason: z.nativeEnum(RevocationReason),
  details: z.string().optional(),
  category: z.enum(['FRAUD', 'MISREPRESENTATION', 'VOLUNTARY', 'POLICY', 'MISCONDUCT', 'ADMINISTRATIVE', 'OTHER']).optional(),
});

export type RevocationReasonData = z.infer<typeof RevocationReasonSchema>;

/**
 * Get category for a revocation reason
 */
export function getRevocationCategory(reason: RevocationReason): string {
  switch (reason) {
    case RevocationReason.FRAUD:
    case RevocationReason.IDENTITY_THEFT:
    case RevocationReason.FORGERY:
      return 'FRAUD';

    case RevocationReason.MISREPRESENTATION:
    case RevocationReason.FALSE_CLAIMS:
    case RevocationReason.DOCUMENT_FALSIFICATION:
      return 'MISREPRESENTATION';

    case RevocationReason.VOLUNTARY:
    case RevocationReason.RESIGNATION:
    case RevocationReason.RETIREMENT:
      return 'VOLUNTARY';

    case RevocationReason.POLICY_VIOLATION:
    case RevocationReason.CODE_OF_CONDUCT_VIOLATION:
    case RevocationReason.COMPLIANCE_FAILURE:
      return 'POLICY';

    case RevocationReason.PROFESSIONAL_MISCONDUCT:
    case RevocationReason.DISCIPLINARY_ACTION:
    case RevocationReason.LICENSE_REVOCATION:
      return 'MISCONDUCT';

    case RevocationReason.EXPIRATION:
    case RevocationReason.NON_RENEWAL:
    case RevocationReason.ADMINISTRATIVE_ERROR:
      return 'ADMINISTRATIVE';

    default:
      return 'OTHER';
  }
}

/**
 * Get human-readable label for revocation reason
 */
export function getRevocationReasonLabel(reason: RevocationReason): string {
  const labels: Record<RevocationReason, string> = {
    [RevocationReason.FRAUD]: 'Fraud',
    [RevocationReason.IDENTITY_THEFT]: 'Identity Theft',
    [RevocationReason.FORGERY]: 'Forgery',
    [RevocationReason.MISREPRESENTATION]: 'Misrepresentation',
    [RevocationReason.FALSE_CLAIMS]: 'False Claims',
    [RevocationReason.DOCUMENT_FALSIFICATION]: 'Document Falsification',
    [RevocationReason.VOLUNTARY]: 'Voluntary',
    [RevocationReason.RESIGNATION]: 'Resignation',
    [RevocationReason.RETIREMENT]: 'Retirement',
    [RevocationReason.POLICY_VIOLATION]: 'Policy Violation',
    [RevocationReason.CODE_OF_CONDUCT_VIOLATION]: 'Code of Conduct Violation',
    [RevocationReason.COMPLIANCE_FAILURE]: 'Compliance Failure',
    [RevocationReason.PROFESSIONAL_MISCONDUCT]: 'Professional Misconduct',
    [RevocationReason.DISCIPLINARY_ACTION]: 'Disciplinary Action',
    [RevocationReason.LICENSE_REVOCATION]: 'License Revocation',
    [RevocationReason.EXPIRATION]: 'Expiration',
    [RevocationReason.NON_RENEWAL]: 'Non-Renewal',
    [RevocationReason.ADMINISTRATIVE_ERROR]: 'Administrative Error',
    [RevocationReason.OTHER]: 'Other',
  };

  return labels[reason] || 'Unknown';
}


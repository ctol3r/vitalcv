export type RevocationReasonCode = 'disciplinary' | 'expired' | 'fraud';

export interface RevocationReasonOption {
  value: RevocationReasonCode;
  label: string;
  description: string;
}

export interface RevocationPolicyView {
  credentialType: string;
  allowedReasons: RevocationReasonCode[];
  approver: 'issuer' | 'verifier' | 'governance';
  slaHours: number;
}

export const REVOCATION_REASON_OPTIONS: RevocationReasonOption[] = [
  {
    value: 'disciplinary',
    label: 'Disciplinary action',
    description: 'Formal disciplinary action or board ruling.',
  },
  {
    value: 'expired',
    label: 'Credential expired',
    description: 'Credential lapsed or expired without renewal.',
  },
  {
    value: 'fraud',
    label: 'Fraud or misrepresentation',
    description: 'Fraudulent claims or misrepresentation detected.',
  },
];

const DEFAULT_POLICY: RevocationPolicyView = {
  credentialType: 'Default',
  allowedReasons: ['disciplinary', 'expired', 'fraud'],
  approver: 'issuer',
  slaHours: 72,
};

const REVOCATION_POLICIES: Record<string, RevocationPolicyView> = {
  'Medical License': {
    credentialType: 'Medical License',
    allowedReasons: ['disciplinary', 'expired', 'fraud'],
    approver: 'governance',
    slaHours: 24,
  },
  'Board Certification': {
    credentialType: 'Board Certification',
    allowedReasons: ['disciplinary', 'expired', 'fraud'],
    approver: 'issuer',
    slaHours: 48,
  },
  'DEA Registration': {
    credentialType: 'DEA Registration',
    allowedReasons: ['disciplinary', 'expired', 'fraud'],
    approver: 'governance',
    slaHours: 12,
  },
  'Nursing License': {
    credentialType: 'Nursing License',
    allowedReasons: ['disciplinary', 'expired', 'fraud'],
    approver: 'issuer',
    slaHours: 24,
  },
  'Pharmacy License': {
    credentialType: 'Pharmacy License',
    allowedReasons: ['disciplinary', 'expired', 'fraud'],
    approver: 'issuer',
    slaHours: 24,
  },
};

export function getRevocationPolicyView(credentialType?: string | null): RevocationPolicyView {
  if (!credentialType) return DEFAULT_POLICY;
  return REVOCATION_POLICIES[credentialType] ?? { ...DEFAULT_POLICY, credentialType };
}

export function getReasonOptionsForPolicy(policy: RevocationPolicyView): RevocationReasonOption[] {
  return REVOCATION_REASON_OPTIONS.filter((option) => policy.allowedReasons.includes(option.value));
}

export type RevocationReason = 'disciplinary' | 'expired' | 'fraud';

export type RevocationApprover = 'issuer' | 'verifier' | 'governance';

export interface RevocationPolicy {
  credentialType: string;
  allowedReasons: RevocationReason[];
  approver: RevocationApprover;
  slaHours: number;
}

const DEFAULT_REASONS: RevocationReason[] = ['disciplinary', 'expired', 'fraud'];

const REVOCATION_POLICIES: Record<string, RevocationPolicy> = {
  'Medical License': {
    credentialType: 'Medical License',
    allowedReasons: DEFAULT_REASONS,
    approver: 'governance',
    slaHours: 24,
  },
  'Board Certification': {
    credentialType: 'Board Certification',
    allowedReasons: DEFAULT_REASONS,
    approver: 'issuer',
    slaHours: 48,
  },
  'DEA Registration': {
    credentialType: 'DEA Registration',
    allowedReasons: DEFAULT_REASONS,
    approver: 'governance',
    slaHours: 12,
  },
  'Nursing License': {
    credentialType: 'Nursing License',
    allowedReasons: DEFAULT_REASONS,
    approver: 'issuer',
    slaHours: 24,
  },
  'Pharmacy License': {
    credentialType: 'Pharmacy License',
    allowedReasons: DEFAULT_REASONS,
    approver: 'issuer',
    slaHours: 24,
  },
};

const DEFAULT_POLICY: RevocationPolicy = {
  credentialType: 'Default',
  allowedReasons: DEFAULT_REASONS,
  approver: 'issuer',
  slaHours: 72,
};

export function listRevocationPolicies(): RevocationPolicy[] {
  return Object.values(REVOCATION_POLICIES);
}

export function getRevocationPolicy(credentialType?: string | null): RevocationPolicy {
  if (!credentialType) return DEFAULT_POLICY;
  return REVOCATION_POLICIES[credentialType] ?? {
    ...DEFAULT_POLICY,
    credentialType,
  };
}

export function normalizeRevocationReason(input?: string | null): RevocationReason | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === 'disciplinary' || normalized === 'expired' || normalized === 'fraud') {
    return normalized;
  }
  return null;
}

export function evaluateRevocationPolicy(params: {
  credentialType?: string | null;
  reasonCode?: RevocationReason | null;
  actorRole?: string | null;
}): {
  policy: RevocationPolicy;
  satisfied: boolean;
  failureReasons: string[];
} {
  const policy = getRevocationPolicy(params.credentialType ?? undefined);
  const failureReasons: string[] = [];
  const reasonOk = params.reasonCode ? policy.allowedReasons.includes(params.reasonCode) : false;
  if (!reasonOk) failureReasons.push('reason_not_allowed');

  const actorRole = (params.actorRole || '').toLowerCase();
  const approverOk = actorRole === policy.approver;
  if (!approverOk) failureReasons.push('approver_mismatch');

  return {
    policy,
    satisfied: reasonOk && approverOk,
    failureReasons,
  };
}

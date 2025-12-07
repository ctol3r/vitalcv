export const ReasonCatalog = {
  EXPired: {
    code: 'EXPired',
    httpStatus: 410,
    message: 'Credential expired',
    auditTag: 'verification.expired',
  },
  REVoked: {
    code: 'REVoked',
    httpStatus: 409,
    message: 'Credential revoked via StatusList',
    auditTag: 'verification.revoked',
  },
  SIGInvalid: {
    code: 'SIGInvalid',
    httpStatus: 400,
    message: 'Issuer signature failed validation',
    auditTag: 'verification.signature_invalid',
  },
  NONCEReuse: {
    code: 'NONCEReuse',
    httpStatus: 401,
    message: 'Presentation nonce already consumed or mismatched',
    auditTag: 'verification.nonce_reuse',
  },
  ISSUERUntrusted: {
    code: 'ISSUERUntrusted',
    httpStatus: 403,
    message: 'Issuer key not found in trust registry',
    auditTag: 'verification.issuer_untrusted',
  },
  ISSUERBlacklisted: {
    code: 'ISSUERBlacklisted',
    httpStatus: 403,
    message: 'Issuer blocked due to repeated trust breaches',
    auditTag: 'verification.issuer_blacklisted',
  },
} as const;

export type ReasonCode = keyof typeof ReasonCatalog;

export interface ReasonDescriptor {
  code: ReasonCode;
  httpStatus: number;
  message: string;
  auditTag: string;
}

export function describeReason(
  code: ReasonCode,
  overrides?: Partial<Omit<ReasonDescriptor, 'code'>>,
): ReasonDescriptor {
  const base = ReasonCatalog[code];
  return {
    code,
    httpStatus: overrides?.httpStatus ?? base.httpStatus,
    message: overrides?.message ?? base.message,
    auditTag: overrides?.auditTag ?? base.auditTag,
  };
}



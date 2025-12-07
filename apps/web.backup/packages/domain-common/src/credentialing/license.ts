const LICENSE_STATUS_VALUES = [
  'active',
  'inactive',
  'expired',
  'suspended',
  'revoked',
  'probation'
] as const;

export type LicenseStatus = (typeof LICENSE_STATUS_VALUES)[number];
export type LicenseStatusAnyCase = LicenseStatus | Uppercase<LicenseStatus>;

export const LICENSE_STATUSES: readonly LicenseStatus[] = LICENSE_STATUS_VALUES;


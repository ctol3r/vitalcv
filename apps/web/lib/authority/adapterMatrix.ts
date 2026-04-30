/**
 * ENTERPRISE-VANGUARD-6A — authority adapter matrix foundation.
 *
 * Truth invariants:
 *   1. The matrix is an interface and catalog only. It performs no network
 *      calls and does not write to a backend.
 *   2. Every adapter in this foundation carries `isLive: false`.
 *   3. `allAdaptersLive: false` is a typed literal so report routes cannot
 *      accidentally imply production authority verification.
 */

export type AuthorityAdapterCapability =
  | 'verify_license'
  | 'check_disciplinary'
  | 'get_expiration'
  | 'get_limitations'
  | 'check_dea'
  | 'check_npi_match';

export type AuthorityAdapterStatus = 'live' | 'stub' | 'planned' | 'unavailable';

export interface AuthorityAdapter {
  adapterId: string;
  authorityName: string;
  state?: string;
  capabilities: AuthorityAdapterCapability[];
  status: AuthorityAdapterStatus;
  isLive: false;
  checkLicenseStatus(npi: string): Promise<{ found: boolean; active: boolean | null; reason: string }>;
  checkDisciplinaryActions(npi: string): Promise<{ hasActions: boolean | null; reason: string }>;
  getExpirationDate(npi: string): Promise<{ expiresAt: string | null; reason: string }>;
  getLimitations(npi: string): Promise<{ limitations: string[]; reason: string }>;
}

export interface AdapterMatrix {
  adapters: AuthorityAdapter[];
  allAdaptersLive: false;
}

export function buildAdapterMatrix(): AdapterMatrix {
  return {
    adapters: [],
    allAdaptersLive: false,
  };
}

export function getAdapterForState(state: string): AuthorityAdapter | undefined {
  const normalized = state.trim().toUpperCase();
  return buildAdapterMatrix().adapters.find((adapter) => adapter.state?.toUpperCase() === normalized);
}

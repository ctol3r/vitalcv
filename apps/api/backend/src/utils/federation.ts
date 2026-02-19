export type TrustLevel = 'full' | 'partial' | 'proof-only';
export type TrustLookup = (sourceOrgId: string, targetOrgId: string) => Promise<TrustLevel | null> | TrustLevel | null;

function normalizeOrgId(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export async function resolveCrossOrgTrustLevel(params: {
  requestOrganizationId: string | undefined | null;
  artifactOrganizationId: string | undefined | null;
  isSuperAdmin: boolean;
  resolveTrustLevel: TrustLookup;
}): Promise<TrustLevel | null> {
  if (params.isSuperAdmin) {
    return 'full';
  }

  const requestOrg = normalizeOrgId(params.requestOrganizationId);
  const artifactOrg = normalizeOrgId(params.artifactOrganizationId);
  if (!artifactOrg || !requestOrg) {
    return null;
  }

  if (requestOrg === artifactOrg) {
    return 'full';
  }

  return params.resolveTrustLevel(requestOrg, artifactOrg);
}

import { OrgMembershipRole, Prisma, PrismaClient, SsoProvider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { writeSecret, readSecret } from '../../security/vaultClient';

const prisma = new PrismaClient();
const SECRET_PREFIX = 'auth/sso/providers';

export interface CreateSsoProviderInput {
  orgId: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  domainWhitelist?: string[];
  autoProvisionRole?: OrgMembershipRole;
}

export interface UpdateSsoProviderInput {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  domainWhitelist?: string[];
  autoProvisionRole?: OrgMembershipRole;
}

function normalizeIssuer(issuer: string): string {
  try {
    const url = new URL(issuer.trim());
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('Issuer must be a valid URL');
  }
}

function normalizeRedirectUri(uri: string): string {
  try {
    const url = new URL(uri);
    return url.toString();
  } catch {
    throw new Error('redirectUri must be a valid URL');
  }
}

function normalizeDomains(domains: string[] = []): string[] {
  return domains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function buildSecretPath(orgId: string, providerId?: string): string {
  const suffix = providerId ?? randomUUID();
  return `${SECRET_PREFIX}/${orgId}/${suffix}`;
}

export async function createSsoProvider(
  input: CreateSsoProviderInput
): Promise<SsoProvider> {
  const issuer = normalizeIssuer(input.issuer);
  const redirectUri = normalizeRedirectUri(input.redirectUri);
  const domainWhitelist = normalizeDomains(input.domainWhitelist);
  const secretPath = buildSecretPath(input.orgId);

  await writeSecret(secretPath, input.clientSecret);

  return prisma.ssoProvider.create({
    data: {
      orgId: input.orgId,
      issuer,
      clientId: input.clientId.trim(),
      clientSecretKey: secretPath,
      redirectUri,
      domainWhitelist,
      autoProvisionRole: input.autoProvisionRole ?? OrgMembershipRole.REVIEWER,
    },
  });
}

export async function updateSsoProvider(
  id: string,
  updates: UpdateSsoProviderInput
): Promise<SsoProvider> {
  const data: Prisma.SsoProviderUpdateInput = {};

  if (updates.issuer) {
    data.issuer = normalizeIssuer(updates.issuer);
  }
  if (updates.clientId) {
    data.clientId = updates.clientId.trim();
  }
  if (updates.redirectUri) {
    data.redirectUri = normalizeRedirectUri(updates.redirectUri);
  }
  if (updates.domainWhitelist) {
    data.domainWhitelist = normalizeDomains(updates.domainWhitelist);
  }
  if (updates.autoProvisionRole) {
    data.autoProvisionRole = updates.autoProvisionRole;
  }

  const provider = await prisma.ssoProvider.update({
    where: { id },
    data,
  });

  if (updates.clientSecret) {
    await writeSecret(provider.clientSecretKey, updates.clientSecret);
  }

  return provider;
}

export function deleteSsoProvider(id: string): Promise<SsoProvider> {
  return prisma.ssoProvider.delete({ where: { id } });
}

export function getSsoProviderByOrg(orgId: string): Promise<SsoProvider | null> {
  return prisma.ssoProvider.findUnique({
    where: { orgId },
  });
}

export function getSsoProviderById(id: string): Promise<SsoProvider | null> {
  return prisma.ssoProvider.findUnique({ where: { id } });
}

export function listSsoProviders(orgId?: string): Promise<SsoProvider[]> {
  return prisma.ssoProvider.findMany({
    where: orgId ? { orgId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSsoClientSecret(provider: SsoProvider): Promise<string> {
  return readSecret(provider.clientSecretKey);
}

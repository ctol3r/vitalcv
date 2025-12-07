import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { anchorUxConfig } from '../audit/anchor';

const prisma = new PrismaClient();
type ExtendedPrisma = PrismaClient & Record<string, any>;

const DEFAULT_PROFILES: Record<string, Record<string, unknown>> = {
  clinician: {
    actionBar: {
      actions: [
        { id: 'refresh-fabric', label: 'Refresh fabric', href: '/credential-fabric', icon: 'RefreshCcw' },
        { id: 'share-wallet', label: 'Share wallet', href: '/wallet/interop', icon: 'Share2' },
      ],
    },
    terminology: {
      issue: 'Creating or updating an authoritative credential from a source of truth.',
      verify: 'Validating inputs against issuers, boards, compacts, or NPDB.',
      anchor: 'Commit a snapshot hash on chain for independent verification.',
      revoke: 'Invalidate a credential and propagate downstream proofs.',
    },
    notifications: {
      channels: ['banner', 'toast', 'email'],
      subscriptions: ['fabric', 'wallet', 'privileges'],
    },
    navigationGuards: ['/trust-anchors', '/observability-grid'],
    errorLanguage: {
      generic: 'We ran into a snag. Try again or refresh your credential fabric.',
    },
    accessibility: { prefersLargeText: false, prefersHighContrast: false },
  },
  admin: {
    actionBar: {
      actions: [
        { id: 'trust-anchors', label: 'Trust anchors', href: '/trust-anchors', icon: 'Shield' },
        { id: 'observability', label: 'Observability', href: '/observability-grid', icon: 'Activity' },
      ],
    },
    terminology: {
      issue: 'Authorize an issuer to emit a credential.',
      verify: 'Run policy checks across employers and validators.',
      anchor: 'Record policy outcomes for audit.',
      revoke: 'Invalidate issuers or wallets that violate policy.',
    },
    notifications: {
      channels: ['banner', 'email'],
      subscriptions: ['trust', 'observability', 'workforce'],
    },
    navigationGuards: [],
    errorLanguage: {
      generic: 'Administrative action failed. Review the log stream for details.',
    },
    accessibility: { prefersLargeText: false, prefersHighContrast: true },
  },
};

export async function getRoleUxProfile(role: string, options: { prisma?: PrismaClient } = {}) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const normalizedRole = role || 'clinician';
  const record = await client.roleUXConfig.findUnique({
    where: { role: normalizedRole },
  });
  if (record) {
    return {
      role: normalizedRole,
      uxProfile: record.uxProfile,
      updatedAt: record.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }
  const profile = DEFAULT_PROFILES[normalizedRole] ?? DEFAULT_PROFILES.clinician;
  const created = await client.roleUXConfig.create({
    data: {
      role: normalizedRole,
      uxProfile: profile,
    },
  });
  anchorUxConfig({
    role: normalizedRole,
    version: created.version ?? 1,
    hash: createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
  });
  return {
    role: normalizedRole,
    uxProfile: profile,
    updatedAt: created.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function saveRoleUxProfile(
  role: string,
  profile: Record<string, unknown>,
  options: { prisma?: PrismaClient } = {},
) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const normalizedRole = role || 'clinician';
  const record = await client.roleUXConfig.upsert({
    where: { role: normalizedRole },
    create: { role: normalizedRole, uxProfile: profile },
    update: { uxProfile: profile, updatedAt: new Date(), version: { increment: 1 } },
  });
  anchorUxConfig({
    role: normalizedRole,
    version: record.version ?? 1,
    hash: createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
  });
  return {
    role: normalizedRole,
    uxProfile: record.uxProfile,
  };
}

export async function listRoleUxConfigs(options: { prisma?: PrismaClient } = {}) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const configs = await client.roleUXConfig.findMany({ orderBy: { updatedAt: 'desc' } });
  return configs.map((config: any) => ({
    role: config.role,
    uxProfile: config.uxProfile,
    updatedAt: config.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  }));
}


import {
  PrismaClient,
  type CountryEquivalencyRule,
  type Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

export type EquivalencyLevel = 'FULL' | 'PARTIAL' | 'MANUAL';

export interface GlobalEquivalencyInput {
  country: string;
  foreignType: string;
  descriptor?: string;
}

export interface GlobalEquivalencyResult {
  country: string;
  foreignType: string;
  usEquivalent: string;
  level: EquivalencyLevel;
  metadata: Record<string, unknown>;
  ruleId?: string;
  source: 'db' | 'static' | 'fallback';
}

type StaticRule = {
  country: string;
  foreignType: string;
  usEquivalent: string;
  level: EquivalencyLevel;
  metadata: Record<string, unknown>;
};

const STATIC_RULES: StaticRule[] = [
  {
    country: 'CANADA',
    foreignType: 'RN(CA)',
    usEquivalent: 'US-RN-BSN',
    level: 'FULL',
    metadata: {
      basis: 'NCSBN mobility compact',
      requiredSteps: ['Nursys verification'],
    },
  },
  {
    country: 'AUSTRALIA',
    foreignType: 'MBBS',
    usEquivalent: 'US-MD',
    level: 'PARTIAL',
    metadata: {
      basis: 'AMC/AHPRA reciprocity',
      requiredSteps: ['USMLE Step 2 CK', 'State board interview'],
    },
  },
  {
    country: 'INDIA',
    foreignType: 'MBBS',
    usEquivalent: 'US-PGY1',
    level: 'MANUAL',
    metadata: {
      basis: 'USMLE/ECFMG IMG pathway',
      requiredSteps: ['ECFMG certification', 'Residency director attestation'],
    },
  },
  {
    country: 'PHILIPPINES',
    foreignType: 'BSN',
    usEquivalent: 'US-RN',
    level: 'PARTIAL',
    metadata: {
      basis: 'CGFNS certification',
      requiredSteps: ['IELTS/TOEFL', 'NCLEX retake'],
    },
  },
];

export async function evaluateGlobalEquivalency(
  input: GlobalEquivalencyInput,
  options: { prisma?: PrismaClient } = {},
): Promise<GlobalEquivalencyResult> {
  const client = options.prisma ?? prisma;
  const normalizedCountry = normalizeCountry(input.country);
  const normalizedType = normalizeForeignType(input.foreignType);

  const dbRule = await lookupRule(client, normalizedCountry, normalizedType);
  if (dbRule) {
    return formatRuleResult(dbRule, 'db');
  }

  const staticRule = findStaticRule(normalizedCountry, normalizedType);
  if (staticRule) {
    await upsertStaticRule(client, staticRule);
    return {
      ...staticRule,
      country: normalizedCountry,
      foreignType: normalizeForeignType(staticRule.foreignType),
      metadata: {
        ...staticRule.metadata,
        descriptor: input.descriptor ?? null,
      },
      source: 'static',
    };
  }

  return {
    country: normalizedCountry,
    foreignType: normalizedType,
    usEquivalent: 'REVIEW_REQUIRED',
    level: 'MANUAL',
    metadata: {
      descriptor: input.descriptor ?? null,
      reason: `No automated rule for ${normalizedCountry}-${normalizedType}.`,
    },
    source: 'fallback',
  };
}

async function lookupRule(
  client: PrismaClient,
  country: string,
  foreignType: string,
): Promise<CountryEquivalencyRule | null> {
  const direct = await client.countryEquivalencyRule.findUnique({
    where: {
      country_foreignType: {
        country,
        foreignType,
      },
    },
  });

  if (direct) {
    return direct;
  }

  const candidates = await client.countryEquivalencyRule.findMany({
    where: { country },
  });

  return (
    candidates.find(
      (rule) => compress(rule.foreignType) === compress(foreignType),
    ) ?? null
  );
}

function findStaticRule(country: string, foreignType: string): StaticRule | null {
  return (
    STATIC_RULES.find(
      (rule) =>
        normalizeCountry(rule.country) === country &&
        compress(rule.foreignType) === compress(foreignType),
    ) ?? null
  );
}

async function upsertStaticRule(client: PrismaClient, rule: StaticRule) {
  await client.countryEquivalencyRule.upsert({
    where: {
      country_foreignType: {
        country: normalizeCountry(rule.country),
        foreignType: normalizeForeignType(rule.foreignType),
      },
    },
    update: {
      usEquivalent: rule.usEquivalent,
      level: rule.level,
      metadata: rule.metadata as Prisma.JsonValue,
    },
    create: {
      country: normalizeCountry(rule.country),
      foreignType: normalizeForeignType(rule.foreignType),
      usEquivalent: rule.usEquivalent,
      level: rule.level,
      metadata: rule.metadata as Prisma.JsonValue,
    },
  });
}

function formatRuleResult(
  rule: CountryEquivalencyRule,
  source: GlobalEquivalencyResult['source'],
): GlobalEquivalencyResult {
  return {
    country: rule.country,
    foreignType: rule.foreignType,
    usEquivalent: rule.usEquivalent,
    level: rule.level.toUpperCase() as EquivalencyLevel,
    metadata: {
      ...(rule.metadata as Record<string, unknown>),
    },
    ruleId: rule.id,
    source,
  };
}

function normalizeCountry(country: string): string {
  return country?.trim().toUpperCase() || 'UNKNOWN';
}

function normalizeForeignType(type: string): string {
  return type?.trim().toUpperCase() || 'CREDENTIAL';
}

function compress(value: string): string {
  return normalizeForeignType(value).replace(/[^A-Z0-9]/g, '');
}











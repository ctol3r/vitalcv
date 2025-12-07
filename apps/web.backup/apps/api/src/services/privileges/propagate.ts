import { PrismaClient, type Prisma } from '@prisma/client';
import { anchorPrivilegePropagation } from '../audit/anchor';

export interface PropagationTrigger {
  systemId: string;
  originatingSiteId: string;
  clinicianId: string;
  packId: string;
  privilegeCodes: string[];
  specialty?: string;
  approvedAt?: string;
  actorId?: string;
}

export interface PropagationDecision {
  siteId: string;
  packId?: string;
  autoPropagated: boolean;
  missingPrivileges: string[];
  privilegeCoverage: number;
  reasons: string[];
  propagatedSetId?: string;
  propagatedVersion?: number;
}

export interface PropagationResult {
  policy: Prisma.PrivilegePropagationPolicyGetPayload<{}> | null;
  decisions: PropagationDecision[];
}

export class PrivilegePropagationEngine {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = new PrismaClient()) {
    this.prisma = prismaClient;
  }

  async propagate(trigger: PropagationTrigger): Promise<PropagationResult> {
    const policy = await this.prisma.privilegePropagationPolicy.findFirst({
      where: { systemId: trigger.systemId },
    });

    if (!policy) {
      return { policy: null, decisions: [] };
    }

    const targetSites = policy.sites.filter((site) => site && site !== trigger.originatingSiteId);
    if (targetSites.length === 0) {
      return { policy, decisions: [] };
    }

    const packs = await this.prisma.privilegePack.findMany({
      where: { orgId: { in: targetSites } },
    });
    const packByOrg = new Map(packs.map((pack) => [pack.orgId, pack]));
    const decisions: PropagationDecision[] = [];

    for (const siteId of targetSites) {
      const pack = packByOrg.get(siteId);
      if (!pack) {
        decisions.push({
          siteId,
          autoPropagated: false,
          packId: undefined,
          missingPrivileges: [...trigger.privilegeCodes],
          privilegeCoverage: 0,
          reasons: ['No privilege pack configured for site'],
        });
        continue;
      }

      const packCodes = extractPrivilegeCodes(pack);
      const missing = diff(trigger.privilegeCodes, packCodes);
      const coverage =
        trigger.privilegeCodes.length === 0
          ? 1
          : (trigger.privilegeCodes.length - missing.length) / trigger.privilegeCodes.length;
      const autoPropagated = policy.propagate && missing.length === 0;

      const decision: PropagationDecision = {
        siteId,
        packId: pack.id,
        autoPropagated,
        missingPrivileges: missing,
        privilegeCoverage: Number(coverage.toFixed(3)),
        reasons: [],
      };

      if (missing.length) {
        decision.reasons.push(`Missing privileges: ${missing.join(', ')}`);
      }

      if (autoPropagated) {
        if (trigger.specialty) {
          const propagatedSet = await this.ensurePrivilegeSet(siteId, trigger.specialty, packCodes);
          if (propagatedSet) {
            decision.propagatedSetId = propagatedSet.id;
            decision.propagatedVersion = propagatedSet.version;
            decision.reasons.push(`PrivilegeSet v${propagatedSet.version} issued for ${siteId}`);
          }
        }
        decision.reasons.push('Auto-propagated via policy');
        await anchorPrivilegePropagation({
          clinicianId: trigger.clinicianId,
          siteId,
          packId: pack.id,
          systemId: trigger.systemId,
          propagatedAt: trigger.approvedAt ?? new Date().toISOString(),
          auto: true,
          reasons: decision.reasons,
        });
      }

      decisions.push(decision);
    }

    return { policy, decisions };
  }

  private async ensurePrivilegeSet(
    hospitalId: string,
    specialty: string,
    procedures: string[],
  ): Promise<{ id: string; version: number } | null> {
    const normalizedProcedures = normalizePrivilegeList(procedures);
    const latest = await this.prisma.privilegeSet.findFirst({
      where: { hospitalId, specialty },
      orderBy: { version: 'desc' },
    });

    if (latest) {
      const latestProcedures = normalizePrivilegeList(latest.procedures ?? []);
      if (areListsEqual(normalizedProcedures, latestProcedures)) {
        return { id: latest.id, version: latest.version };
      }
    }

    const version = (latest?.version ?? 0) + 1;
    const record = await this.prisma.privilegeSet.create({
      data: {
        hospitalId,
        specialty,
        procedures: normalizedProcedures,
        version,
        updatedAt: new Date(),
      },
    });
    return { id: record.id, version: record.version };
  }
}

function extractPrivilegeCodes(pack: Prisma.PrivilegePackGetPayload<{}>): string[] {
  const rules = (pack.rules as { requires?: string[]; anyOf?: string[] } | null) ?? null;
  const tokens = [
    ...(Array.isArray(rules?.requires) ? rules?.requires : []),
    ...(Array.isArray(rules?.anyOf) ? rules?.anyOf : []),
  ];
  return normalizePrivilegeList(tokens);
}

function normalizePrivilegeCode(value?: string | null): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function diff(required: string[], owned: string[]): string[] {
  if (!required.length) {
    return [];
  }
  const ownedSet = new Set(owned);
  return required.filter((code) => !ownedSet.has(code));
}

function normalizePrivilegeList(values: string[]): string[] {
  return dedupeStrings(values.map(normalizePrivilegeCode)).sort();
}

function areListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}



import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';
import { normalizePrivilegeCode } from '../../privileging/models/PrivilegeMatrix';
import { EhrSystem, normalizeEhrSystem } from '../models/EHROrderableMap';

type PrismaLike = Pick<PrismaClient, 'eHROrderableMap' | 'ehrConfig'>;

export interface MapPrivilegesInput {
  orgId: string;
  privilegeCodes: string[];
  ehrSystem?: string;
}

export interface MappedOrderable {
  privilegeCode: string;
  ehrCode: string;
  description?: string | null;
  requiredRoles: string[];
}

export interface PrivilegeToEHRMapperResult {
  ehrSystem: EhrSystem;
  orderables: MappedOrderable[];
  missingPrivilegeCodes: string[];
  requiredRoles: string[];
}

export class PrivilegeToEHRMapper {
  private readonly log = getServiceLogger('ehr/mapper/privilegeToEHRMapper');

  constructor(private readonly prisma: PrismaLike = new PrismaClient()) {}

  async mapPrivileges(input: MapPrivilegesInput): Promise<PrivilegeToEHRMapperResult> {
    if (!input.privilegeCodes.length) {
      throw new Error('At least one privilege code is required to map to EHR orderables');
    }

    const ehrSystem = await this.resolveEhrSystem(input.orgId, input.ehrSystem);
    const normalizedCodes = input.privilegeCodes.map(normalizePrivilegeCode);

    const records = await this.prisma.eHROrderableMap.findMany({
      where: {
        privilegeCode: { in: normalizedCodes },
        ehrSystem,
      },
    });

    const recordMap = new Map(records.map((record) => [record.privilegeCode, record]));
    const orderables: MappedOrderable[] = [];
    const missing: string[] = [];

    for (const code of normalizedCodes) {
      const record = recordMap.get(code);
      if (!record) {
        missing.push(code);
        continue;
      }

      orderables.push({
        privilegeCode: record.privilegeCode,
        ehrCode: record.ehrCode,
        description: record.description,
        requiredRoles: record.requiredRoles ?? [],
      });
    }

    const requiredRoles = Array.from(new Set(orderables.flatMap((entry) => entry.requiredRoles)));

    if (missing.length) {
      this.log.warn('Missing EHR orderable mappings', { orgId: input.orgId, ehrSystem, missing });
    }

    return {
      ehrSystem,
      orderables,
      missingPrivilegeCodes: missing,
      requiredRoles,
    };
  }

  private async resolveEhrSystem(orgId: string, override?: string): Promise<EhrSystem> {
    if (override) {
      return normalizeEhrSystem(override);
    }

    const config = await this.prisma.ehrConfig.findUnique({
      where: { orgId },
      select: { ehrType: true },
    });

    if (!config?.ehrType) {
      throw new Error(`Organization ${orgId} does not have an active EHR configuration`);
    }

    return normalizeEhrSystem(config.ehrType);
  }
}

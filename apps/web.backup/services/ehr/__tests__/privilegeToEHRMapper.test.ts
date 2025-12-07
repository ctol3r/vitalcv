import { PrivilegeToEHRMapper } from '../mapper/privilegeToEHRMapper';

const createPrismaMock = (overrides?: Partial<any>) => ({
  eHROrderableMap: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  ehrConfig: {
    findUnique: jest.fn().mockResolvedValue({ ehrType: 'epic' }),
  },
  ...overrides,
});

describe('PrivilegeToEHRMapper', () => {
  it('maps privileges to EHR orderables with explicit system override', async () => {
    const prisma = createPrismaMock({
      eHROrderableMap: {
        findMany: jest.fn().mockResolvedValue([
          {
            privilegeCode: 'CARD-CATH-ADULT',
            ehrCode: 'EPC.CARD.CATH.ADULT',
            description: 'Epic cath orderable',
            requiredRoles: ['CARD.CATH.ORDER'],
          },
        ]),
      },
    });

    const mapper = new PrivilegeToEHRMapper(prisma as any);
    const result = await mapper.mapPrivileges({
      orgId: 'org-1',
      privilegeCodes: ['card cath adult'],
      ehrSystem: 'EPIC',
    });

    expect(result.ehrSystem).toBe('EPIC');
    expect(result.orderables).toHaveLength(1);
    expect(result.requiredRoles).toEqual(['CARD.CATH.ORDER']);
    expect(prisma.ehrConfig.findUnique).not.toHaveBeenCalled();
  });

  it('uses org EHR config when override is not provided', async () => {
    const prisma = createPrismaMock({
      ehrConfig: {
        findUnique: jest.fn().mockResolvedValue({ ehrType: 'cerner' }),
      },
      eHROrderableMap: {
        findMany: jest.fn().mockResolvedValue([
          {
            privilegeCode: 'ANES-GENERAL-ADULT',
            ehrCode: 'CRN_ANES_GENERAL',
            description: 'Cerner general anesthesia auth',
            requiredRoles: ['ANES.SUPERVISOR', 'ANES.PROVIDER'],
          },
        ]),
      },
    });

    const mapper = new PrivilegeToEHRMapper(prisma as any);
    const result = await mapper.mapPrivileges({
      orgId: 'org-2',
      privilegeCodes: ['ANES-GENERAL-ADULT', 'CARD-PCI-PRIMARY'],
    });

    expect(result.ehrSystem).toBe('CERNER');
    expect(result.orderables[0].privilegeCode).toBe('ANES-GENERAL-ADULT');
    expect(result.missingPrivilegeCodes).toEqual(['CARD-PCI-PRIMARY']);
    expect(result.requiredRoles).toEqual(['ANES.SUPERVISOR', 'ANES.PROVIDER']);
  });

  it('throws when organization lacks an EHR configuration', async () => {
    const prisma = createPrismaMock({
      ehrConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    const mapper = new PrivilegeToEHRMapper(prisma as any);

    await expect(
      mapper.mapPrivileges({ orgId: 'org-missing', privilegeCodes: ['CARD-CATH-ADULT'] })
    ).rejects.toThrow('does not have an active EHR configuration');
  });
});


import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { runAutoHoldTrigger } from '../triggers/autoHold';
import { runAutoFPPETrigger } from '../triggers/autoFPPE';
import { runAutoReviewTrigger } from '../triggers/autoReview';
import { PrivilegeGraphBuilder } from '../../privyDep/buildGraph';
import { buildPrivilegeNode } from '../../privyDep/models/PrivilegeNode';
import { buildPrivilegeDependency } from '../../privyDep/models/PrivilegeDependency';
import { RestrictionEngine } from '../restrictionEngine';
import { notifyClinicianSafetyEvent } from '../triggers/helpers';
import { generateCommitteePacketSnapshot } from '../../committeePacket/assemble';

jest.mock('../../timeline/logCredentialTimelineEvent', () => ({
  logCredentialTimelineEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../triggers/helpers', () => ({
  notifyClinicianSafetyEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../committeePacket/assemble', () => ({
  generateCommitteePacketSnapshot: jest.fn().mockResolvedValue({
    packetId: 'packet-123',
  }),
}));

const graph = new PrivilegeGraphBuilder(
  [
    buildPrivilegeNode({
      privilegeCode: 'core privilege',
      name: 'Core Privilege',
      category: 'procedural',
      description: 'Core procedure',
      specialty: 'Anesthesiology',
    }),
    buildPrivilegeNode({
      privilegeCode: 'dependent privilege',
      name: 'Dependent Privilege',
      category: 'procedural',
      description: 'Dependent procedure',
      specialty: 'Anesthesiology',
    }),
  ],
  [
    buildPrivilegeDependency({
      parentPrivilegeCode: 'core privilege',
      childPrivilegeCode: 'dependent privilege',
      dependencyType: 'REQUIRES',
    }),
  ],
).build();

function createPrismaStub(overrides: Record<string, any> = {}) {
  const stateCreates: any[] = [];
  const fppeCreates: any[] = [];

  return {
    privilegeSafetySignal: {
      create: jest
        .fn()
        .mockImplementation(async ({ data }: { data: any }) => ({ id: `sig-${Date.now()}`, ...data })),
      count: jest.fn().mockResolvedValue(overrides.signalCount ?? 0),
    },
    privilegeSafetyState: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const record = { id: `state-${stateCreates.length + 1}`, ...data };
        stateCreates.push(record);
        return record;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    fppeCase: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const record = { id: `fppe-${fppeCreates.length + 1}`, ...data };
        fppeCreates.push(record);
        return record;
      }),
    },
    clinicianProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'clinician-1', userId: 'user-1' }),
    },
    ...overrides.extra,
    __stateCreates: stateCreates,
    __fppeCreates: fppeCreates,
  };
}

describe('safety triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('autoHold persists HOLD states and notifies clinicians', async () => {
    const prisma = createPrismaStub();
    const engine = new RestrictionEngine();

    const result = await runAutoHoldTrigger(
      {
        clinicianId: 'clinician-1',
        orgId: 'org-1',
        privilegeCodes: ['core privilege'],
        signalType: 'NPDB_FLAG',
        summary: 'NPDB critical signal',
        source: 'npdb',
      },
      { prisma: prisma as any, engine, graph },
    );

    expect(result.createdStates).toHaveLength(2); // direct + cascade
    expect(prisma.privilegeSafetyState.create).toHaveBeenCalled();
    expect(notifyClinicianSafetyEvent).toHaveBeenCalledWith(
      prisma,
      'clinician-1',
      'PRIVILEGE_AUTO_HOLD',
      expect.objectContaining({ privilegeCodes: expect.any(Array) }),
    );
  });

  it('autoFPPE creates FPPE cases only once per privilege', async () => {
    const prisma = createPrismaStub();
    const engine = new RestrictionEngine();

    const result = await runAutoFPPETrigger(
      {
        clinicianId: 'clinician-1',
        orgId: 'org-1',
        privilegeGrantedId: 'grant-1',
        privilegeCodes: ['core privilege'],
        signalType: 'QUALITY_RISK',
        summary: 'Outcome variance',
        source: 'quality-hub',
      },
      { prisma: prisma as any, engine, graph },
    );

    expect(result.fppeCaseIds).toHaveLength(1);
    expect(prisma.fppeCase.create).toHaveBeenCalledTimes(1);
    expect(prisma.privilegeSafetyState.create).toHaveBeenCalled();
  });

  it('autoReview escalates only after reaching threshold', async () => {
    const prismaBelow = createPrismaStub({ signalCount: 1 });
    const engine = new RestrictionEngine();
    const noEscalation = await runAutoReviewTrigger(
      {
        clinicianId: 'clinician-1',
        orgId: 'org-1',
        privilegeCodes: ['core privilege'],
        signalType: 'QUALITY_RISK',
        summary: 'Trend spike',
        source: 'ops',
        threshold: 2,
      },
      { prisma: prismaBelow as any, engine, graph },
    );

    expect(noEscalation.escalated).toBe(false);

    const prismaThreshold = createPrismaStub({ signalCount: 3 });
    const escalation = await runAutoReviewTrigger(
      {
        clinicianId: 'clinician-1',
        orgId: 'org-1',
        privilegeCodes: ['core privilege'],
        signalType: 'QUALITY_RISK',
        summary: 'Repeated variance',
        source: 'ops',
        threshold: 2,
      },
      { prisma: prismaThreshold as any, engine, graph },
    );

    expect(escalation.escalated).toBe(true);
    expect(prismaThreshold.privilegeSafetyState.create).toHaveBeenCalled();
    expect(generateCommitteePacketSnapshot).toHaveBeenCalled();
  });
});


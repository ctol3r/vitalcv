import { PrismaClient } from '@prisma/client';
import { GraphBuilder, type GraphBuilderInput } from '../graph/builder/graphBuilder.js';
import { GraphQueryEngine } from '../graph/queryEngine.js';
import { validateMobilityPrerequisites } from './validatePrereqs.js';
import { loadOrgMobilityRequirements } from './engine.js';

type SourcePrivilege = Awaited<ReturnType<typeof validateMobilityPrerequisites>>['sourcePrivileges'][number];

const prisma = new PrismaClient();

export interface PrivilegeRebuildInput {
  clinicianId: string;
  sourceOrgId: string;
  targetOrgId: string;
  dryRun?: boolean;
}

export interface PrivilegeRebuildResult {
  createdSets: Array<{ id: string; name: string; privilegeCodes: string[] }>;
  reusedSets: Array<{ id: string; name: string }>;
  missingMatrixCodes: string[];
  graphStats: {
    nodes: number;
    edges: number;
  };
}

export async function rebuildPrivilegeSetsForOrg(
  input: PrivilegeRebuildInput
): Promise<PrivilegeRebuildResult> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: input.clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${input.clinicianId} not found`);
  }

  const [sourceOrg, targetOrg] = await Promise.all([
    prisma.partnerConfig.findUnique({ where: { id: input.sourceOrgId } }),
    prisma.partnerConfig.findUnique({ where: { id: input.targetOrgId } }),
  ]);

  if (!sourceOrg || !targetOrg) {
    throw new Error('Source or target organization not found');
  }

  const requirements = await loadOrgMobilityRequirements(input.targetOrgId);
  const prereqResult = await validateMobilityPrerequisites({
    clinicianId: input.clinicianId,
    clinicianDid: clinician.user?.did,
    sourceOrgId: input.sourceOrgId,
    requirements,
  });

  if (prereqResult.sourcePrivileges.length === 0) {
    return {
      createdSets: [],
      reusedSets: [],
      missingMatrixCodes: [],
      graphStats: { nodes: 0, edges: 0 },
    };
  }

  const licenseRecords = await prisma.stateLicenseVerification.findMany({
    where: { clinicianId: input.clinicianId },
  });

  const payerEnrollments = await prisma.payerEnrollmentV2.findMany({
    where: { clinicianId: input.clinicianId },
  });

  const graphStats = await buildSourceGraph({
    clinician,
    sourceOrg,
    licenseRecords,
    payerEnrollments,
    privileges: prereqResult.sourcePrivileges,
  });

  const setIds = Array.from(
    new Set(
      prereqResult.sourcePrivileges
        .map((priv) => priv.privilegeSetV2Id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const privilegeSetRecords = setIds.length
    ? await prisma.privilegeSetV2.findMany({
        where: { id: { in: setIds } },
      })
    : [];
  const setLookup = new Map(privilegeSetRecords.map((record) => [record.id, record]));

  const codes = Array.from(
    new Set(prereqResult.sourcePrivileges.flatMap((priv) => priv.privilegeCodes))
  );

  const matrixEntries = await prisma.privilegeMatrix.findMany({
    where: { privilegeCode: { in: codes } },
  });
  const matrixByCode = new Map(matrixEntries.map((entry) => [entry.privilegeCode, entry]));

  const blueprints = buildPrivilegeBlueprints(prereqResult.sourcePrivileges, { clinician, sourceOrg }, setLookup);

  const createdSets: Array<{ id: string; name: string; privilegeCodes: string[] }> = [];
  const reusedSets: Array<{ id: string; name: string }> = [];
  const missingMatrixCodes = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const blueprint of blueprints) {
      const targetName = `${blueprint.name} (${sourceOrg.partnerName} → ${targetOrg.partnerName})`;
      const existing = await tx.privilegeSetV2.findFirst({
        where: {
          orgId: input.targetOrgId,
          name: targetName,
        },
      });

      if (existing) {
        reusedSets.push({ id: existing.id, name: existing.name });
        continue;
      }

      if (input.dryRun) {
        createdSets.push({
          id: `preview-${targetName}`,
          name: targetName,
          privilegeCodes: blueprint.codes,
        });
        continue;
      }

      const set = await tx.privilegeSetV2.create({
        data: {
          orgId: input.targetOrgId,
          name: targetName,
          specialty: blueprint.specialty ?? clinician.specialty,
          description: `Mobility copy of ${blueprint.name} from ${sourceOrg.partnerName}`,
        },
      });

      for (const code of blueprint.codes) {
        const matrix = matrixByCode.get(code);
        if (!matrix) {
          missingMatrixCodes.add(code);
          continue;
        }
        await tx.privilegeSetV2Privilege.create({
          data: {
            privilegeSetV2Id: set.id,
            privilegeMatrixId: matrix.id,
            privilegeCode: matrix.privilegeCode,
          },
        });
      }

      createdSets.push({
        id: set.id,
        name: set.name,
        privilegeCodes: blueprint.codes,
      });
    }
  });

  return {
    createdSets,
    reusedSets,
    missingMatrixCodes: Array.from(missingMatrixCodes),
    graphStats,
  };
}

async function buildSourceGraph(params: {
  clinician: any;
  sourceOrg: any;
  licenseRecords: any[];
  payerEnrollments: any[];
  privileges: SourcePrivilege[];
}) {
  const builder = new GraphBuilder();
  const graphInput: GraphBuilderInput = {
    clinician: {
      id: params.clinician.id,
      npi: params.clinician.npi ?? undefined,
      name: params.clinician.user?.name ?? undefined,
      state: params.clinician.state,
      org: {
        id: params.sourceOrg.id,
        name: params.sourceOrg.partnerName,
      },
    },
    licenses: params.licenseRecords.map((license) => ({
      id: license.id,
      state: license.state,
      number: license.licenseNumber,
      status: license.status,
    })),
    payerEnrollments: params.payerEnrollments.map((enrollment) => ({
      id: enrollment.id,
      payerId: enrollment.payerId,
      payerName: enrollment.payerId,
    })),
    privileges: params.privileges.map((priv) => ({
      id: priv.privilegeGrantedId,
      facilityId: params.sourceOrg.id,
      facilityName: params.sourceOrg.partnerName,
      licenseIds: params.licenseRecords.map((license) => license.id),
      payerEnrollmentIds: params.payerEnrollments.map((enrollment) => enrollment.id),
      metadata: {
        privilegeSetId: priv.privilegeSetId,
        privilegeSetV2Id: priv.privilegeSetV2Id,
        privilegeCodes: priv.privilegeCodes,
      },
    })),
  };

  const graph = builder.build(graphInput);
  const query = new GraphQueryEngine(graph);
  // Touch query to ensure graph is traversable
  if (graphInput.privileges.length > 0) {
    query.getNeighbors(graphInput.privileges[0].id, { direction: 'both' });
  }

  return {
    nodes: graph.nodes.size,
    edges: graph.edges.length,
  };
}

function buildPrivilegeBlueprints(
  sourcePrivileges: Array<{
    privilegeSetId: string;
    privilegeSetV2Id?: string | null;
    privilegeCodes: string[];
  }>,
  context: {
    clinician: { specialty: string };
    sourceOrg: { partnerName: string };
  },
  setLookup: Map<
    string,
    {
      id: string;
      name: string;
      specialty: string;
      description: string | null;
    }
  >
) {
  const grouped = new Map<
    string,
    {
      name: string;
      specialty: string;
      codes: string[];
    }
  >();

  for (const privilege of sourcePrivileges) {
    const key = privilege.privilegeSetV2Id ?? privilege.privilegeSetId;
    const existing = grouped.get(key);
    const setRecord = privilege.privilegeSetV2Id ? setLookup.get(privilege.privilegeSetV2Id) : undefined;
    if (existing) {
      existing.codes = Array.from(new Set([...existing.codes, ...privilege.privilegeCodes]));
    } else {
      grouped.set(key, {
        name:
          setRecord?.name ??
          (privilege.privilegeSetV2Id ? `Set ${privilege.privilegeSetV2Id}` : `Legacy Set ${privilege.privilegeSetId}`),
        specialty: setRecord?.specialty ?? context.clinician.specialty,
        codes: Array.from(new Set(privilege.privilegeCodes)),
      });
    }
  }

  return Array.from(grouped.values());
}


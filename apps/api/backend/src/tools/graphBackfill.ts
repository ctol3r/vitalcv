import { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import {
  syncEmployerDecisionEvent,
  syncOpportunityNode,
  syncOrganizationNode,
  syncProviderDecisionSnapshot,
  syncTrustGraphForPrismaWrite,
} from '../services/graph-engine/graphSyncEngine';

type Options = {
  apply: boolean;
  limit: number;
  batchSize: number;
  npi?: string;
};

function usage(): string {
  return [
    'Usage:',
    '  pnpm exec ts-node src/tools/graphBackfill.ts [--apply] [--limit 200] [--batch-size 25] [--npi 1234567890]',
    '',
    'Defaults to dry-run. Use --apply to write GraphNode/GraphEdge rows.',
  ].join('\n');
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    limit: 200,
    batchSize: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--apply') {
      options.apply = true;
      continue;
    }
    if (token === '--limit' && next) {
      options.limit = Math.max(1, Number.parseInt(next, 10) || 200);
      index += 1;
      continue;
    }
    if (token === '--batch-size' && next) {
      options.batchSize = Math.max(1, Number.parseInt(next, 10) || 25);
      index += 1;
      continue;
    }
    if (token === '--npi' && next) {
      options.npi = next;
      index += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      console.log(usage());
      process.exit(0);
    }
  }

  return options;
}

async function collectDistinctNpis(limit: number, npi?: string): Promise<string[]> {
  if (npi) {
    return [npi];
  }

  const [artifacts, claims, decisions, snapshots] = await Promise.all([
    prisma.verificationArtifact.findMany({ select: { npi: true }, distinct: ['npi'], take: limit }),
    prisma.claimRecord.findMany({ select: { subjectNpi: true }, distinct: ['subjectNpi'], take: limit }),
    prisma.decisionCapsule.findMany({ select: { subjectNpi: true }, distinct: ['subjectNpi'], take: limit }),
    prisma.providerDecisionState.findMany({ select: { npi: true }, distinct: ['npi'], take: limit }),
  ]);

  return [...new Set([
    ...artifacts.map((row) => row.npi),
    ...claims.map((row) => row.subjectNpi),
    ...decisions.map((row) => row.subjectNpi),
    ...snapshots.map((row) => row.npi),
  ])].slice(0, limit);
}

async function chunked<T>(values: T[], size: number, fn: (batch: T[]) => Promise<void>): Promise<void> {
  for (let index = 0; index < values.length; index += size) {
    await fn(values.slice(index, index + size));
  }
}

async function safeOptionalFindMany<T>(operation: () => Promise<T[]>): Promise<T[]> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return [];
    }
    throw error;
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('graphBackfill requires DATABASE_URL');
  }

  const options = parseArgs(process.argv.slice(2));
  const [organizations, opportunities, employerEvents, npis] = await Promise.all([
    prisma.organization.findMany({ select: { id: true }, take: options.limit, orderBy: { createdAt: 'asc' } }),
    safeOptionalFindMany(() =>
      prisma.opportunity.findMany({ select: { id: true }, take: options.limit, orderBy: { createdAt: 'asc' } })),
    safeOptionalFindMany(() =>
      prisma.employerDecisionEvent.findMany({ select: { id: true }, take: options.limit, orderBy: { decidedAt: 'asc' } })),
    collectDistinctNpis(options.limit, options.npi),
  ]);

  const summary = {
    apply: options.apply,
    organizations: organizations.length,
    opportunities: opportunities.length,
    employerDecisionEvents: employerEvents.length,
    npis: npis.length,
    batchSize: options.batchSize,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!options.apply) {
    return;
  }

  await chunked(organizations.map((row) => row.id), options.batchSize, async (batch) => {
    await Promise.all(batch.map((id) => syncOrganizationNode(id, prisma)));
  });

  await chunked(opportunities.map((row) => row.id), options.batchSize, async (batch) => {
    await Promise.all(batch.map((id) => syncOpportunityNode(id, prisma)));
  });

  await chunked(npis, options.batchSize, async (batch) => {
    for (const npi of batch) {
      await syncProviderDecisionSnapshot(npi, prisma);

      const [artifactRows, claimRows, capsuleRows, anomalyRows] = await Promise.all([
        prisma.verificationArtifact.findMany({ where: { npi }, select: { id: true } }),
        prisma.claimRecord.findMany({ where: { subjectNpi: npi }, select: { id: true } }),
        prisma.decisionCapsule.findMany({ where: { subjectNpi: npi }, select: { id: true } }),
        prisma.anomalyHistory.findMany({
          where: {
            subjectType: 'NPI',
            subjectId: npi,
            anomalyKey: { startsWith: 'div_' },
          },
          select: { id: true, anomalyKey: true, subjectType: true, subjectId: true },
        }),
      ]);

      for (const row of artifactRows) {
        await syncTrustGraphForPrismaWrite(prisma, {
          model: 'VerificationArtifact',
          action: 'backfill',
          record: { id: row.id },
        });
      }

      for (const row of claimRows) {
        await syncTrustGraphForPrismaWrite(prisma, {
          model: 'ClaimRecord',
          action: 'backfill',
          record: { id: row.id },
        });
      }

      for (const row of capsuleRows) {
        await syncTrustGraphForPrismaWrite(prisma, {
          model: 'DecisionCapsule',
          action: 'backfill',
          record: { id: row.id },
        });
      }

      for (const row of anomalyRows) {
        await syncTrustGraphForPrismaWrite(prisma, {
          model: 'AnomalyHistory',
          action: 'backfill',
          record: row as unknown as Record<string, unknown>,
        });
      }
    }
  });

  await chunked(employerEvents.map((row) => row.id), options.batchSize, async (batch) => {
    await Promise.all(batch.map((id) => syncEmployerDecisionEvent(id, prisma)));
  });

  const result = await Promise.all([
    prisma.graphNode.count({ where: { active: true } }),
    prisma.graphEdge.count({ where: { status: 'ACTIVE' } }),
  ]);

  console.log(JSON.stringify({
    apply: true,
    activeNodeCount: result[0],
    activeEdgeCount: result[1],
  }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import { anchorWorkforceGridSnapshot } from '../audit/anchor';

const prisma = new PrismaClient();
type ExtendedPrisma = PrismaClient & Record<string, any>;

export interface SupplyNodeInput {
  region: string;
  specialty: string;
  supply: number;
  demand: number;
  readiness?: number;
}

export interface WorkforceGridSnapshot {
  region: string;
  nodes: Array<{
    region: string;
    specialty: string;
    supply: number;
    demand: number;
    readiness: number;
    readinessAdjustedSupply: number;
    risk: number;
  }>;
  suggestions: Array<{ id: string; specialty: string; recommendation: string; impact: string }>;
  riskIndex: number;
  heatmap: Array<{ region: string; specialty: string; severity: number }>;
  generatedAt: string;
}

export async function ingestSupplyChainNodes(
  inputs: SupplyNodeInput[],
  options: { prisma?: PrismaClient } = {},
) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  await Promise.all(
    inputs.map((node) =>
      client.supplyChainNode.upsert({
        where: { id: `${node.region}:${node.specialty}` },
        update: {
          supply: node.supply,
          demand: node.demand,
          readiness: node.readiness ?? 1,
          updatedAt: new Date(),
        },
        create: {
          id: `${node.region}:${node.specialty}`,
          region: node.region,
          specialty: node.specialty,
          supply: node.supply,
          demand: node.demand,
          readiness: node.readiness ?? 1,
        },
      }),
    ),
  );
}

export async function buildWorkforceGrid(
  region = 'global',
  options: { prisma?: PrismaClient } = {},
): Promise<WorkforceGridSnapshot> {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const [nodes, trends] = await Promise.all([
    client.supplyChainNode.findMany({ where: region === 'global' ? {} : { region } }),
    client.workforceTrend.findMany({ where: region === 'global' ? {} : { region }, take: 50 }),
  ]);

  const nodeSummaries = nodes.map((node: any) => {
    const readinessScore = node.readiness ?? 1;
    const readinessAdjustedSupply = node.supply * readinessScore;
    const risk = Math.max(0, node.demand - readinessAdjustedSupply);
    return {
      region: node.region,
      specialty: node.specialty,
      supply: Number(node.supply.toFixed(2)),
      demand: Number(node.demand.toFixed(2)),
      readiness: Number(readinessScore.toFixed(3)),
      readinessAdjustedSupply: Number(readinessAdjustedSupply.toFixed(2)),
      risk: Number(risk.toFixed(2)),
    };
  });

  const riskIndex = nodeSummaries.length
    ? nodeSummaries.reduce((sum, node) => sum + node.risk, 0) / nodeSummaries.length
    : 0;

  const suggestions = buildOptimizationSuggestions(nodeSummaries, trends);
  const heatmap = nodeSummaries.map((node) => ({
    region: node.region,
    specialty: node.specialty,
    severity: Math.min(1, node.risk / Math.max(node.demand, 1)),
  }));

  anchorWorkforceGridSnapshot({
    region,
    nodeCount: nodeSummaries.length,
    highRiskNodes: nodeSummaries.filter((node) => node.risk > node.demand * 0.2).length,
    snapshotHash: hashValue({ region, riskIndex, nodes: nodeSummaries.length }),
  });

  return {
    region,
    nodes: nodeSummaries,
    suggestions,
    riskIndex: Number(riskIndex.toFixed(2)),
    heatmap,
    generatedAt: new Date().toISOString(),
  };
}

function buildOptimizationSuggestions(
  nodes: WorkforceGridSnapshot['nodes'],
  trends: any[],
) {
  const suggestions: WorkforceGridSnapshot['suggestions'] = [];
  nodes
    .filter((node) => node.risk > node.demand * 0.15)
    .slice(0, 5)
    .forEach((node) => {
      const trend = trends.find((entry: any) => entry.specialty === node.specialty);
      const recommendation = trend?.predicted?.training
        ? 'Accelerate training pipeline'
        : node.readiness < 0.8
          ? 'Boost readiness coaching'
          : 'Expand hiring funnel';
      suggestions.push({
        id: `${node.region}:${node.specialty}`,
        specialty: node.specialty,
        recommendation,
        impact: node.risk > node.demand * 0.3 ? 'high' : 'medium',
      });
    });
  return suggestions;
}

function hashValue(value: unknown) {
  return JSON.stringify(value);
}


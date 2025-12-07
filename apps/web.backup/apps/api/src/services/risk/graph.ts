import { PrismaClient, type RiskGraphEdge } from '@prisma/client';
import { anchorRiskGraphSnapshot } from '../audit/anchor';

const prisma = new PrismaClient();
const SIGNALS = ['sanctions', 'fraud', 'npdb', 'behavior', 'readiness', 'composite'] as const;

export interface RiskGraphNodeView {
  id: string;
  label: string;
  severity: number;
  category: 'compliance' | 'fraud' | 'readiness';
  lastSignal?: string;
  details?: Record<string, unknown>;
  centrality?: number;
}

export type RiskGraphEdgeView = RiskGraphEdge & { active?: boolean };

export interface RiskGraphSnapshot {
  clinicianId: string;
  nodes: RiskGraphNodeView[];
  edges: RiskGraphEdgeView[];
  metrics: {
    centrality: Record<string, number>;
    propagationPaths: string[][];
    compositeRiskScore: number;
    focusSignal?: string;
    updatedAt: string;
  };
}

export interface RiskGraphOptions {
  anchor?: boolean;
  focusSignal?: string;
  activeEdges?: Set<string>;
}

export class RiskGraphBuilder {
  private readonly prisma: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.prisma = client;
  }

  async generate(clinicianId: string, options: RiskGraphOptions = {}): Promise<RiskGraphSnapshot> {
    const [riskEvents, readiness, edges] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where: { clinicianId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.clinicianReadinessScore.findUnique({ where: { clinicianId } }),
      this.ensureEdges(clinicianId),
    ]);

    const nodes = this.buildNodes(riskEvents, readiness);
    const centrality = this.calculateCentrality(nodes, edges);
    const propagationPaths = this.calculatePropagationPaths(nodes, edges);
    const compositeRiskScore =
      nodes.find((node) => node.id === 'composite')?.severity ??
      nodes.reduce((sum, node) => sum + node.severity, 0) / nodes.length;

    const activeEdgeIds = options.activeEdges ?? new Set<string>();
    for (const path of propagationPaths) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const pair = `${path[index]}->${path[index + 1]}`;
        activeEdgeIds.add(pair);
      }
    }

    const edgeViews = edges.map((edge) => ({
      ...edge,
      active: activeEdgeIds.has(`${edge.fromSignal}->${edge.toSignal}`) || edge.fromSignal === options.focusSignal,
    }));

    const snapshot: RiskGraphSnapshot = {
      clinicianId,
      nodes: nodes.map((node) => ({ ...node, centrality: centrality[node.id] ?? 0 })),
      edges: edgeViews,
      metrics: {
        centrality,
        propagationPaths,
        compositeRiskScore: Number(compositeRiskScore.toFixed(4)),
        focusSignal: options.focusSignal,
        updatedAt: new Date().toISOString(),
      },
    };

    if (options.anchor !== false) {
      anchorRiskGraphSnapshot({
        clinicianId,
        nodeScores: snapshot.nodes.map((node) => ({ id: node.id, severity: node.severity })),
        edges: edges.map((edge) => ({
          fromSignal: edge.fromSignal,
          toSignal: edge.toSignal,
          weight: edge.weight,
        })),
        severityState: snapshot.metrics.compositeRiskScore,
        focusSignal: options.focusSignal,
      });
    }

    return snapshot;
  }

  private buildNodes(
    riskEvents: Awaited<ReturnType<PrismaClient['riskEvent']['findMany']>>,
    readiness?: { score: number; factors: unknown; updatedAt: Date } | null,
  ): RiskGraphNodeView[] {
    const latestByType = new Map<string, typeof riskEvents[number]>();
    for (const event of riskEvents) {
      if (!latestByType.has(event.type)) {
        latestByType.set(event.type, event);
      }
    }

    return SIGNALS.map((signal) => {
      const event = latestByType.get(signal);
      const severity = event?.severity ?? this.defaultSeverity(signal, readiness?.score);
      return {
        id: signal,
        label: this.mapLabel(signal),
        category: this.mapCategory(signal),
        severity: Number(Math.min(1, Math.max(0, severity)).toFixed(4)),
        lastSignal: event?.createdAt?.toISOString(),
        details:
          signal === 'readiness'
            ? {
                score: readiness?.score ?? 0.6,
                factors: readiness?.factors ?? {},
              }
            : (event?.metadata as Record<string, unknown> | undefined),
      };
    });
  }

  private defaultSeverity(signal: string, readinessScore?: number) {
    if (signal === 'readiness') {
      return readinessScore ?? 0.62;
    }
    if (signal === 'composite') {
      return 0.5;
    }
    return 0.35;
  }

  private mapLabel(signal: string) {
    switch (signal) {
      case 'npdb':
        return 'NPDB';
      case 'fraud':
        return 'Fraud';
      case 'sanctions':
        return 'Sanctions';
      case 'behavior':
        return 'Behavior';
      case 'readiness':
        return 'Readiness';
      case 'composite':
        return 'Composite';
      default:
        return signal;
    }
  }

  private mapCategory(signal: string): RiskGraphNodeView['category'] {
    if (signal === 'fraud' || signal === 'behavior') {
      return 'fraud';
    }
    if (signal === 'readiness' || signal === 'composite') {
      return 'readiness';
    }
    return 'compliance';
  }

  private async ensureEdges(clinicianId: string): Promise<RiskGraphEdge[]> {
    const existing = await this.prisma.riskGraphEdge.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length) {
      return existing;
    }

    const defaults = [
      { fromSignal: 'sanctions', toSignal: 'npdb', weight: 0.7 },
      { fromSignal: 'fraud', toSignal: 'sanctions', weight: 0.6 },
      { fromSignal: 'behavior', toSignal: 'fraud', weight: 0.5 },
      { fromSignal: 'npdb', toSignal: 'readiness', weight: 0.45 },
      { fromSignal: 'sanctions', toSignal: 'readiness', weight: 0.5 },
      { fromSignal: 'fraud', toSignal: 'composite', weight: 0.4 },
    ];

    await this.prisma.riskGraphEdge.createMany({
      data: defaults.map((edge) => ({
        clinicianId,
        fromSignal: edge.fromSignal,
        toSignal: edge.toSignal,
        weight: edge.weight,
      })),
    });

    return this.prisma.riskGraphEdge.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private calculateCentrality(
    nodes: RiskGraphNodeView[],
    edges: RiskGraphEdge[],
  ): Record<string, number> {
    const centrality: Record<string, number> = {};
    for (const node of nodes) {
      const degree =
        edges.filter((edge) => edge.fromSignal === node.id || edge.toSignal === node.id).length ??
        0;
      centrality[node.id] = Number(
        (degree / Math.max(1, nodes.length - 1)).toFixed(3),
      );
    }
    return centrality;
  }

  private calculatePropagationPaths(
    nodes: RiskGraphNodeView[],
    edges: RiskGraphEdge[],
  ): string[][] {
    const highSeverityNodes = nodes.filter((node) => node.severity >= 0.75).map((node) => node.id);
    const adjacency = edges.reduce<Map<string, string[]>>((map, edge) => {
      const next = map.get(edge.fromSignal) ?? [];
      next.push(edge.toSignal);
      map.set(edge.fromSignal, next);
      return map;
    }, new Map());

    const paths: string[][] = [];
    for (const source of highSeverityNodes) {
      const visited = new Set<string>([source]);
      const queue: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }];
      while (queue.length) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current.node) ?? [];
        for (const neighbor of neighbors) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          const path = [...current.path, neighbor];
          paths.push(path);
          queue.push({ node: neighbor, path });
        }
      }
    }
    return paths;
  }
}











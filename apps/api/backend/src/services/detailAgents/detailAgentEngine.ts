/**
 * detailAgentEngine.ts — Detail Agent Engine
 *
 * Continuous background agents that find and fix small issues
 * before they require founder intervention.
 *
 * Philosophy:
 *   - Auto-repair safe issues silently (log only)
 *   - Surface HIGH+ issues to the findings feed
 *   - Batch LOW issues into periodic summaries
 *   - Never break anything — all repairs are conservative
 *
 * Agents run on configurable intervals and produce DetailReports.
 */

import { log } from '../../obs/logger';
import prisma from '../../graphql/prisma_client';
import { storeFinding, type FindingCategory, type FindingSeverity } from '../investigators/framework';
import { ingestFinding } from '../storylines/storylineEngine';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DetailAgentId =
  | 'qa'
  | 'data-sanity'
  | 'performance'
  | 'schema-consistency'
  | 'api-validation';

export type IssueDisposition = 'AUTO_REPAIRED' | 'SURFACED' | 'BATCHED' | 'IGNORED';

export interface DetailIssue {
  id:           string;
  agent:        DetailAgentId;
  severity:     'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title:        string;
  description:  string;
  disposition:  IssueDisposition;
  repairAction: string | null;   // What was done (if auto-repaired)
  table?:       string;
  field?:       string;
  count?:       number;
  timestamp:    string;
}

export interface DetailReport {
  agent:        DetailAgentId;
  runAt:        string;
  durationMs:   number;
  issuesFound:  number;
  autoRepaired: number;
  surfaced:     number;
  batched:      number;
  issues:       DetailIssue[];
}

export interface DetailAgentConfig {
  id:              DetailAgentId;
  name:            string;
  intervalMs:      number;
  enabled:         boolean;
  autoRepairSafe:  boolean;    // Whether to auto-repair LOW/INFO issues
}

// ── Issue store ────────────────────────────────────────────────────────────────

const recentReports: DetailReport[] = [];
const MAX_REPORTS = 50;
let issueCounter = 0;

function makeIssueId(agent: DetailAgentId): string {
  return `dtl_${agent}_${(++issueCounter).toString(36)}`;
}

function storeReport(report: DetailReport): void {
  recentReports.unshift(report);
  if (recentReports.length > MAX_REPORTS) recentReports.length = MAX_REPORTS;

  // Surface HIGH+ issues as findings
  for (const issue of report.issues) {
    if (issue.disposition === 'SURFACED') {
      const finding = storeFinding({
        investigator: `detail-${issue.agent}`,
        category: 'COMPLIANCE' as FindingCategory,
        severity: issue.severity as FindingSeverity,
        title: issue.title,
        summary: issue.description,
        explanation: `Detail agent "${issue.agent}" detected: ${issue.description}${issue.repairAction ? ` Auto-repair: ${issue.repairAction}` : ''}`,
        npis: [],
        evidence: [{
          source: `DetailAgent:${issue.agent}`,
          claim: issue.title,
          confidence: 0.9,
          timestamp: issue.timestamp,
        }],
        actions: [{
          id: 'investigate',
          label: 'Review issue',
          type: 'investigate',
          payload: { agent: issue.agent, issueId: issue.id },
        }],
        relatedFindings: [],
        metadata: { agent: issue.agent, table: issue.table, field: issue.field, count: issue.count },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      try { ingestFinding(finding); } catch { /* storyline ingestion is best-effort */ }
    }
  }
}

// ── Data Sanity Agent ──────────────────────────────────────────────────────────

async function runDataSanityAgent(): Promise<DetailReport> {
  const startMs = Date.now();
  const issues: DetailIssue[] = [];
  const now = new Date().toISOString();

  // 1. Orphan verification artifacts (NPI format check)
  try {
    const badNpis = await prisma.verificationArtifact.findMany({
      where: { NOT: { npi: { contains: '' } } },
      select: { id: true, npi: true },
      take: 100,
    });
    const invalid = badNpis.filter(a => !/^\d{10}$/.test(a.npi));
    if (invalid.length > 0) {
      issues.push({
        id: makeIssueId('data-sanity'),
        agent: 'data-sanity',
        severity: 'MEDIUM',
        title: `${invalid.length} verification artifact(s) with invalid NPI format`,
        description: `Found ${invalid.length} VerificationArtifact records where NPI doesn't match \\d{10} pattern.`,
        disposition: 'SURFACED',
        repairAction: null,
        table: 'VerificationArtifact',
        field: 'npi',
        count: invalid.length,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[DataSanity] NPI check failed: ${(err as Error)?.message}`);
  }

  // 2. Duplicate artifacts (same NPI + source + same day)
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dupes = await prisma.verificationArtifact.groupBy({
      by: ['npi', 'source'],
      where: { createdAt: { gte: today } },
      _count: { id: true },
      having: { id: { _count: { gt: 3 } } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    if (dupes.length > 0) {
      issues.push({
        id: makeIssueId('data-sanity'),
        agent: 'data-sanity',
        severity: 'LOW',
        title: `${dupes.length} NPI/source pair(s) with >3 artifacts today`,
        description: `Possible duplicate ingestion: ${dupes.map(d => `${d.npi}/${d.source}(${d._count.id})`).join(', ')}`,
        disposition: 'BATCHED',
        repairAction: null,
        table: 'VerificationArtifact',
        count: dupes.length,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[DataSanity] Dupe check failed: ${(err as Error)?.message}`);
  }

  // 3. Empty rawPayload artifacts
  try {
    const emptyPayload = await prisma.verificationArtifact.count({
      where: {
        OR: [
          { rawPayload: { equals: {} } },
          { rawPayload: { equals: null as any } },
        ],
      },
    });
    if (emptyPayload > 0) {
      issues.push({
        id: makeIssueId('data-sanity'),
        agent: 'data-sanity',
        severity: emptyPayload > 50 ? 'HIGH' : 'LOW',
        title: `${emptyPayload} artifact(s) with empty rawPayload`,
        description: `VerificationArtifacts with null/empty rawPayload provide no evidence value.`,
        disposition: emptyPayload > 50 ? 'SURFACED' : 'BATCHED',
        repairAction: null,
        table: 'VerificationArtifact',
        field: 'rawPayload',
        count: emptyPayload,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[DataSanity] Empty payload check failed: ${(err as Error)?.message}`);
  }

  // 4. Graph nodes with degree=0 that have edges (stale degree)
  try {
    const staleNodes = await prisma.graphNode.count({
      where: {
        degree: 0,
        OR: [
          { outgoingEdges: { some: {} } },
          { incomingEdges: { some: {} } },
        ],
      },
    });
    if (staleNodes > 0) {
      // Auto-repair: this is safe
      await prisma.$executeRawUnsafe(`
        UPDATE "GraphNode" n SET degree = (
          SELECT COUNT(*) FROM "GraphEdge" e
          WHERE e."sourceId" = n.id OR e."targetId" = n.id
        ) WHERE n.degree = 0 AND EXISTS (
          SELECT 1 FROM "GraphEdge" e
          WHERE e."sourceId" = n.id OR e."targetId" = n.id
        )
      `);
      issues.push({
        id: makeIssueId('data-sanity'),
        agent: 'data-sanity',
        severity: 'INFO',
        title: `${staleNodes} graph node(s) with stale degree=0 — auto-repaired`,
        description: `Nodes had edges but degree was 0. Degree recalculated from actual edge count.`,
        disposition: 'AUTO_REPAIRED',
        repairAction: `Recalculated degree for ${staleNodes} nodes`,
        table: 'GraphNode',
        field: 'degree',
        count: staleNodes,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[DataSanity] Graph degree check failed: ${(err as Error)?.message}`);
  }

  const report: DetailReport = {
    agent: 'data-sanity',
    runAt: now,
    durationMs: Date.now() - startMs,
    issuesFound: issues.length,
    autoRepaired: issues.filter(i => i.disposition === 'AUTO_REPAIRED').length,
    surfaced: issues.filter(i => i.disposition === 'SURFACED').length,
    batched: issues.filter(i => i.disposition === 'BATCHED').length,
    issues,
  };

  storeReport(report);
  return report;
}

// ── Schema Consistency Agent ───────────────────────────────────────────────────

async function runSchemaConsistencyAgent(): Promise<DetailReport> {
  const startMs = Date.now();
  const issues: DetailIssue[] = [];
  const now = new Date().toISOString();

  // 1. Check for graph edges referencing non-existent nodes
  try {
    const orphanEdges = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`
      SELECT COUNT(*) as cnt FROM "GraphEdge" e
      WHERE NOT EXISTS (SELECT 1 FROM "GraphNode" n WHERE n.id = e."sourceId")
         OR NOT EXISTS (SELECT 1 FROM "GraphNode" n WHERE n.id = e."targetId")
    `);
    const count = Number(orphanEdges[0]?.cnt ?? 0);
    if (count > 0) {
      // Auto-repair: delete orphan edges
      await prisma.$executeRawUnsafe(`
        DELETE FROM "GraphEdge" e
        WHERE NOT EXISTS (SELECT 1 FROM "GraphNode" n WHERE n.id = e."sourceId")
           OR NOT EXISTS (SELECT 1 FROM "GraphNode" n WHERE n.id = e."targetId")
      `);
      issues.push({
        id: makeIssueId('schema-consistency'),
        agent: 'schema-consistency',
        severity: 'MEDIUM',
        title: `${count} orphan graph edge(s) — auto-deleted`,
        description: `Edges referencing non-existent source or target nodes were removed.`,
        disposition: 'AUTO_REPAIRED',
        repairAction: `Deleted ${count} orphan edges`,
        table: 'GraphEdge',
        count,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[SchemaConsistency] Orphan edge check failed: ${(err as Error)?.message}`);
  }

  // 2. Check for duplicate graph nodes (same label + type)
  try {
    const dupeNodes = await prisma.graphNode.groupBy({
      by: ['label', 'type'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });
    if (dupeNodes.length > 0) {
      issues.push({
        id: makeIssueId('schema-consistency'),
        agent: 'schema-consistency',
        severity: 'LOW',
        title: `${dupeNodes.length} duplicate graph node group(s)`,
        description: `Nodes with same label+type: ${dupeNodes.slice(0, 5).map(d => `${d.label}(${d.type},${d._count.id}x)`).join(', ')}`,
        disposition: 'BATCHED',
        repairAction: null,
        table: 'GraphNode',
        count: dupeNodes.length,
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[SchemaConsistency] Dupe node check failed: ${(err as Error)?.message}`);
  }

  const report: DetailReport = {
    agent: 'schema-consistency',
    runAt: now,
    durationMs: Date.now() - startMs,
    issuesFound: issues.length,
    autoRepaired: issues.filter(i => i.disposition === 'AUTO_REPAIRED').length,
    surfaced: issues.filter(i => i.disposition === 'SURFACED').length,
    batched: issues.filter(i => i.disposition === 'BATCHED').length,
    issues,
  };

  storeReport(report);
  return report;
}

// ── Performance Agent ──────────────────────────────────────────────────────────

async function runPerformanceAgent(): Promise<DetailReport> {
  const startMs = Date.now();
  const issues: DetailIssue[] = [];
  const now = new Date().toISOString();

  // 1. Table row counts (detect unexpected growth)
  try {
    const counts = await Promise.all([
      prisma.verificationArtifact.count().then(c => ({ table: 'VerificationArtifact', count: c })),
      prisma.graphNode.count().then(c => ({ table: 'GraphNode', count: c })),
      prisma.graphEdge.count().then(c => ({ table: 'GraphEdge', count: c })),
    ]);

    for (const { table, count } of counts) {
      if (count > 100_000) {
        issues.push({
          id: makeIssueId('performance'),
          agent: 'performance',
          severity: 'MEDIUM',
          title: `${table} has ${count.toLocaleString()} rows`,
          description: `Large table may benefit from index review or archival strategy.`,
          disposition: 'BATCHED',
          repairAction: null,
          table,
          count,
          timestamp: now,
        });
      }
    }
  } catch (err) {
    log('warn', `[Performance] Row count check failed: ${(err as Error)?.message}`);
  }

  // 2. Check for missing indexes on commonly queried fields
  try {
    const indexCheck = await prisma.$queryRawUnsafe<{ indexname: string }[]>(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'VerificationArtifact' AND indexname LIKE '%npi%'
    `);
    if (indexCheck.length === 0) {
      issues.push({
        id: makeIssueId('performance'),
        agent: 'performance',
        severity: 'HIGH',
        title: 'Missing NPI index on VerificationArtifact',
        description: 'VerificationArtifact.npi is heavily queried but has no dedicated index.',
        disposition: 'SURFACED',
        repairAction: null,
        table: 'VerificationArtifact',
        field: 'npi',
        timestamp: now,
      });
    }
  } catch (err) {
    log('warn', `[Performance] Index check failed: ${(err as Error)?.message}`);
  }

  const report: DetailReport = {
    agent: 'performance',
    runAt: now,
    durationMs: Date.now() - startMs,
    issuesFound: issues.length,
    autoRepaired: 0,
    surfaced: issues.filter(i => i.disposition === 'SURFACED').length,
    batched: issues.filter(i => i.disposition === 'BATCHED').length,
    issues,
  };

  storeReport(report);
  return report;
}

// ── Agent Registry + Orchestration ─────────────────────────────────────────────

const AGENTS: Record<DetailAgentId, {
  config: DetailAgentConfig;
  run: () => Promise<DetailReport>;
}> = {
  'data-sanity': {
    config: { id: 'data-sanity', name: 'Data Sanity Agent', intervalMs: 4 * 60 * 60 * 1000, enabled: true, autoRepairSafe: true },
    run: runDataSanityAgent,
  },
  'schema-consistency': {
    config: { id: 'schema-consistency', name: 'Schema Consistency Agent', intervalMs: 6 * 60 * 60 * 1000, enabled: true, autoRepairSafe: true },
    run: runSchemaConsistencyAgent,
  },
  'performance': {
    config: { id: 'performance', name: 'Performance Agent', intervalMs: 12 * 60 * 60 * 1000, enabled: true, autoRepairSafe: false },
    run: runPerformanceAgent,
  },
  'qa': {
    config: { id: 'qa', name: 'QA Agent', intervalMs: 8 * 60 * 60 * 1000, enabled: false, autoRepairSafe: false },
    run: async () => ({ agent: 'qa' as const, runAt: new Date().toISOString(), durationMs: 0, issuesFound: 0, autoRepaired: 0, surfaced: 0, batched: 0, issues: [] }),
  },
  'api-validation': {
    config: { id: 'api-validation', name: 'API Validation Agent', intervalMs: 8 * 60 * 60 * 1000, enabled: false, autoRepairSafe: false },
    run: async () => ({ agent: 'api-validation' as const, runAt: new Date().toISOString(), durationMs: 0, issuesFound: 0, autoRepaired: 0, surfaced: 0, batched: 0, issues: [] }),
  },
};

const agentTimers = new Map<string, ReturnType<typeof setInterval>>();

export function initDetailAgents(): void {
  for (const [id, agent] of Object.entries(AGENTS)) {
    if (!agent.config.enabled || agent.config.intervalMs <= 0) continue;
    if (agentTimers.has(id)) continue;

    const timer = setInterval(async () => {
      try {
        log('info', `[DetailAgent] Running ${id}...`);
        const report = await agent.run();
        log('info', `[DetailAgent] ${id}: ${report.issuesFound} issues, ${report.autoRepaired} auto-repaired, ${report.durationMs}ms`);
      } catch (err) {
        log('error', `[DetailAgent] ${id} failed: ${(err as Error)?.message}`);
      }
    }, agent.config.intervalMs);

    agentTimers.set(id, timer);
    log('info', `[DetailAgent] Scheduled ${id} every ${agent.config.intervalMs / 3600000}h`);
  }
}

export function shutdownDetailAgents(): void {
  for (const [id, timer] of agentTimers) {
    clearInterval(timer);
  }
  agentTimers.clear();
}

export async function runAllDetailAgents(): Promise<DetailReport[]> {
  const reports: DetailReport[] = [];
  for (const agent of Object.values(AGENTS)) {
    if (!agent.config.enabled) continue;
    try {
      reports.push(await agent.run());
    } catch (err) {
      log('error', `[DetailAgent] ${agent.config.id} failed: ${(err as Error)?.message}`);
    }
  }
  return reports;
}

export async function runDetailAgent(id: DetailAgentId): Promise<DetailReport | null> {
  const agent = AGENTS[id];
  if (!agent) return null;
  return agent.run();
}

export function getDetailAgentConfigs(): DetailAgentConfig[] {
  return Object.values(AGENTS).map(a => a.config);
}

export function getRecentReports(limit = 20): DetailReport[] {
  return recentReports.slice(0, limit);
}

export function getSystemHealthSummary(): {
  agents: { id: string; name: string; enabled: boolean; lastRun: string | null; lastIssueCount: number }[];
  totalIssues: number;
  totalAutoRepaired: number;
  totalSurfaced: number;
} {
  const agents = Object.values(AGENTS).map(a => {
    const lastReport = recentReports.find(r => r.agent === a.config.id);
    return {
      id: a.config.id,
      name: a.config.name,
      enabled: a.config.enabled,
      lastRun: lastReport?.runAt ?? null,
      lastIssueCount: lastReport?.issuesFound ?? 0,
    };
  });

  return {
    agents,
    totalIssues: recentReports.reduce((sum, r) => sum + r.issuesFound, 0),
    totalAutoRepaired: recentReports.reduce((sum, r) => sum + r.autoRepaired, 0),
    totalSurfaced: recentReports.reduce((sum, r) => sum + r.surfaced, 0),
  };
}

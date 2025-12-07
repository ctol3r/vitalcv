import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { PrismaClient, type CompactMatrix } from '@prisma/client';
import { normalizeStateCode } from '../../services/compacts/models/CompactParticipation.js';

const prisma = new PrismaClient();
const DEFAULT_CONFIG_FILE = 'config/compact-matrix.v1.1.yaml';

export type CompactSyncChangeType = 'ADDED' | 'REACTIVATED' | 'RULES_UPDATED' | 'INACTIVATED';

export interface CompactSyncChange {
  compact: string;
  state: string;
  type: CompactSyncChangeType;
  previousStatus?: string;
}

interface CompactSyncStats {
  activeStates: number;
  added: number;
  reactivated: number;
  updatedRules: number;
  inactivated: number;
}

export interface CompactSyncSummary {
  configVersion?: string;
  updatedAt: Date;
  totalCompacts: number;
  totalStatesProcessed: number;
  changeCount: number;
  changes: CompactSyncChange[];
  statsByCompact: Record<string, CompactSyncStats>;
}

export interface CompactSyncOptions {
  configPath?: string;
  dryRun?: boolean;
  prisma?: PrismaClient;
}

type CompactMatrixConfig = {
  version?: string;
  compacts?: Record<string, {
    participating_states?: string[];
    special_rules?: Record<string, unknown>;
    active_issues?: Array<{ state: string; issue: string; [key: string]: unknown }>;
    status?: string;
  }>;
  telehealth_rules?: {
    state_specific?: Record<string, unknown>;
  };
};

export async function runMonthlyCompactSync(options: CompactSyncOptions = {}): Promise<CompactSyncSummary> {
  const prismaClient = options.prisma ?? prisma;
  const resolvedConfigPath = resolveConfigPath(
    options.configPath || process.env.COMPACT_MATRIX_CONFIG_PATH || DEFAULT_CONFIG_FILE,
  );

  const config = await loadConfig(resolvedConfigPath);
  const compacts = config.compacts ?? {};
  const changes: CompactSyncChange[] = [];
  const statsByCompact: Record<string, CompactSyncStats> = {};

  const existingEntries = await prismaClient.compactMatrix.findMany();
  const existingIndex = buildExistingIndex(existingEntries);

  for (const [compactKey, compactData] of Object.entries(compacts)) {
    const normalizedCompact = compactKey.toUpperCase();
    const normalizedStates = new Set((compactData.participating_states ?? []).map(normalizeStateCode));
    const existingStates = existingIndex.get(normalizedCompact) ?? new Map<string, CompactMatrix>();

    statsByCompact[normalizedCompact] = {
      activeStates: normalizedStates.size,
      added: 0,
      reactivated: 0,
      updatedRules: 0,
      inactivated: 0,
    };

    for (const state of normalizedStates) {
      const existing = existingStates.get(state);
      const specialRules = buildSpecialRules(normalizedCompact, state, compactData, config.telehealth_rules);

      if (!existing) {
        if (!options.dryRun) {
          await prismaClient.compactMatrix.create({
            data: {
              compact: normalizedCompact,
              state,
              status: 'active',
              specialRules: specialRules ?? undefined,
            },
          });
        }
        statsByCompact[normalizedCompact].added += 1;
        changes.push({ compact: normalizedCompact, state, type: 'ADDED' });
        continue;
      }

      const needsStatusUpdate = existing.status !== 'active';
      const needsRulesUpdate = !areSpecialRulesEqual(existing.specialRules, specialRules);

      if (needsStatusUpdate || needsRulesUpdate) {
        if (!options.dryRun) {
          await prismaClient.compactMatrix.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              specialRules: specialRules ?? undefined,
            },
          });
        }

        if (needsStatusUpdate) {
          statsByCompact[normalizedCompact].reactivated += 1;
          changes.push({
            compact: normalizedCompact,
            state,
            type: 'REACTIVATED',
            previousStatus: existing.status,
          });
        } else {
          statsByCompact[normalizedCompact].updatedRules += 1;
          changes.push({
            compact: normalizedCompact,
            state,
            type: 'RULES_UPDATED',
            previousStatus: existing.status,
          });
        }
      }

      existingStates.delete(state);
    }

    for (const [state, record] of existingStates.entries()) {
      if (record.status === 'inactive') {
        continue;
      }

      if (!options.dryRun) {
        await prismaClient.compactMatrix.update({
          where: { id: record.id },
          data: { status: 'inactive' },
        });
      }

      statsByCompact[normalizedCompact].inactivated += 1;
      changes.push({
        compact: normalizedCompact,
        state,
        type: 'INACTIVATED',
        previousStatus: record.status,
      });
    }
  }

  const summary: CompactSyncSummary = {
    configVersion: config.version,
    updatedAt: new Date(),
    totalCompacts: Object.keys(compacts).length,
    totalStatesProcessed: Object.values(compacts).reduce(
      (total, entry) => total + (entry.participating_states?.length ?? 0),
      0,
    ),
    changeCount: changes.length,
    changes,
    statsByCompact,
  };

  if (!options.dryRun) {
    console.log(
      `[compacts] Monthly sync complete: ${summary.changeCount} changes across ${summary.totalCompacts} compacts`,
    );
  } else {
    console.log('[compacts] Monthly sync dry run summary:', summary);
  }

  return summary;
}

export async function closeCompactSyncClient(): Promise<void> {
  await prisma.$disconnect();
}

function buildExistingIndex(entries: CompactMatrix[]) {
  const index = new Map<string, Map<string, CompactMatrix>>();
  for (const entry of entries) {
    const compact = entry.compact.toUpperCase();
    if (!index.has(compact)) {
      index.set(compact, new Map());
    }
    index.get(compact)!.set(entry.state, entry);
  }
  return index;
}

function buildSpecialRules(
  compact: string,
  state: string,
  compactData: Record<string, any>,
  telehealth?: Record<string, any>,
) {
  const payload: Record<string, unknown> = {};
  if (compactData?.special_rules) {
    payload.general = compactData.special_rules;
  }

  const stateIssues = (compactData?.active_issues ?? []).filter(
    (issue: any) => normalizeStateCode(issue.state) === state,
  );
  if (stateIssues.length > 0) {
    payload.activeIssues = stateIssues;
  }

  if (telehealth?.state_specific?.[state]) {
    payload.telehealth = telehealth.state_specific[state];
  }

  if (compactData?.status) {
    payload.compactStatus = compactData.status;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function areSpecialRulesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function loadConfig(configPath: string): Promise<CompactMatrixConfig> {
  const content = await fs.readFile(configPath, 'utf8');
  const parsed = yaml.load(content) as CompactMatrixConfig;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid compact matrix configuration at ${configPath}`);
  }
  return parsed;
}

function resolveConfigPath(target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
}

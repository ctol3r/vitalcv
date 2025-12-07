import { createHash } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  CAPACITY_SCENARIO_TEMPLATES,
  findCapacityScenarioTemplate,
  type CapacityScenarioParams,
} from '@/src/capacity/scenario';
import { simulateDemandCurves } from '../../services/capacity/demand';
import { simulateSupplyCurves } from '../../services/capacity/supply';
import { calculateCapacityGap } from '../../services/capacity/gap';
import { anchorCapacityScenario } from '../../services/audit/anchor';

const router = Router();
const prisma = new PrismaClient();

interface RunScenarioRequest {
  scenarioId?: string;
  templateKey?: string;
  name?: string;
  orgId?: string;
  params?: Partial<CapacityScenarioParams>;
  persist?: boolean;
}

router.post('/api/capacity/run-scenario', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as RunScenarioRequest;
  const orgId = resolveOrgId(req, body.orgId);
  const scenarioId = typeof body.scenarioId === 'string' ? body.scenarioId : undefined;
  const templateKey = typeof body.templateKey === 'string' ? body.templateKey : undefined;
  const persist = Boolean(body.persist);

  try {
    const result = await resolveScenarioParams({
      scenarioId,
      templateKey,
      overrides: body.params,
      persist,
      orgId,
      name: body.name,
    });

    if (!result) {
      return res.status(400).json({
        error: 'missing_scenario_params',
        message: 'Provide scenarioId, templateKey, or params payload.',
      });
    }

    const demand = simulateDemandCurves(result.params);
    const supply = simulateSupplyCurves(result.params);
    const gap = calculateCapacityGap({
      scenarioName: result.name,
      demand: demand.aggregate,
      supply: supply.aggregate,
      supplySummary: supply.summary,
    });

    const paramsHash = hashParams(result.params);
    const anchorRecord = anchorCapacityScenario({
      scenarioId: result.scenarioId,
      orgId,
      name: result.name,
      paramsHash,
      horizonMonths: result.params.horizonMonths ?? demand.horizonMonths,
      specialties: result.params.specialties.length,
      vitalCvLift: gap.summary.vitalCvLift,
    });

    return res.json({
      scenarioId: result.scenarioId,
      orgId,
      source: result.source,
      templateKey: result.templateKey ?? null,
      name: result.name,
      generatedAt: new Date().toISOString(),
      params: result.params,
      demand,
      supply,
      gap,
      exports: gap.exports,
      paramsHash,
      anchor: {
        id: anchorRecord.id,
        txHash: anchorRecord.txHash,
        merkleRoot: anchorRecord.merkleRoot,
      },
    });
  } catch (error) {
    console.error('[capacity][run-scenario] failed', error);
    return res.status(500).json({
      error: 'capacity_scenario_failed',
      message: error instanceof Error ? error.message : 'Unable to run capacity scenario',
    });
  }
});

async function resolveScenarioParams(input: {
  scenarioId?: string;
  templateKey?: string;
  overrides?: Partial<CapacityScenarioParams>;
  persist: boolean;
  orgId: string;
  name?: string;
}) {
  if (input.scenarioId) {
    const existing = await fetchScenarioById(input.scenarioId);
    if (!existing) {
      throw new Error(`Scenario ${input.scenarioId} not found`);
    }
    const params = mergeScenarioParams(coerceScenarioParams(existing.params), input.overrides);
    const updated =
      input.persist && input.overrides
        ? await updateScenarioRecord(existing.id, input.name ?? existing.name, params)
        : existing;
    return {
      scenarioId: updated.id,
      templateKey: null,
      name: input.name ?? updated.name,
      params,
      source: 'saved' as const,
    };
  }

  if (input.templateKey) {
    const template = findCapacityScenarioTemplate(input.templateKey);
    if (!template) {
      throw new Error(`Unknown template: ${input.templateKey}`);
    }
    const params = mergeScenarioParams(template.params, input.overrides);
    let scenarioId: string | null = null;
    if (input.persist) {
      const created = await insertScenarioRecord(input.orgId, input.name ?? template.name, params);
      scenarioId = created.id;
    }
    return {
      scenarioId,
      templateKey: template.key,
      name: input.name ?? template.name,
      params,
      source: 'template' as const,
    };
  }

  if (input.overrides) {
    const params = mergeScenarioParams(
      {
        startDate: input.overrides.startDate ?? new Date().toISOString(),
        horizonMonths: input.overrides.horizonMonths ?? 12,
        specialties: input.overrides.specialties ?? CAPACITY_SCENARIO_TEMPLATES[0].params.specialties,
        notes: input.overrides.notes ?? [],
        tags: input.overrides.tags ?? [],
      },
      input.overrides,
    );
    let scenarioId: string | null = null;
    if (input.persist) {
      const created = await insertScenarioRecord(input.orgId, input.name ?? 'Custom capacity scenario', params);
      scenarioId = created.id;
    }
    return {
      scenarioId,
      templateKey: null,
      name: input.name ?? 'Custom capacity scenario',
      params,
      source: 'adhoc' as const,
    };
  }

  return null;
}

function mergeScenarioParams(
  base: CapacityScenarioParams,
  overrides?: Partial<CapacityScenarioParams>,
): CapacityScenarioParams {
  if (!overrides) {
    return {
      ...base,
      specialties: [...(base.specialties ?? [])],
    };
  }

  return {
    startDate: overrides.startDate ?? base.startDate ?? new Date().toISOString(),
    horizonMonths: overrides.horizonMonths ?? base.horizonMonths ?? 12,
    notes: overrides.notes ?? base.notes ?? [],
    tags: overrides.tags ?? base.tags ?? [],
    specialties: overrides.specialties?.length
      ? overrides.specialties
      : [...(base.specialties ?? [])],
  };
}

function coerceScenarioParams(value: unknown): CapacityScenarioParams {
  if (typeof value === 'string') {
    try {
      return coerceScenarioParams(JSON.parse(value));
    } catch {
      // fall through to defaults
    }
  }
  if (value && typeof value === 'object') {
    const params = value as CapacityScenarioParams;
    return {
      startDate: params.startDate ?? new Date().toISOString(),
      horizonMonths: params.horizonMonths ?? 12,
      specialties: params.specialties ?? [],
      notes: params.notes ?? [],
      tags: params.tags ?? [],
    };
  }
  return {
    startDate: new Date().toISOString(),
    horizonMonths: 12,
    specialties: CAPACITY_SCENARIO_TEMPLATES[0].params.specialties,
    notes: [],
    tags: [],
  };
}

function resolveOrgId(req: Request, fallback?: string) {
  return (
    req.header('x-org-id') ??
    fallback ??
    'demo-org'
  );
}

function hashParams(params: CapacityScenarioParams): string {
  return createHash('sha256').update(JSON.stringify(params)).digest('hex');
}

type ScenarioRow = {
  id: string;
  orgId: string;
  name: string;
  params: unknown;
  createdAt: Date;
};

async function fetchScenarioById(id: string): Promise<ScenarioRow | null> {
  const rows = await prisma.$queryRaw<ScenarioRow[]>(
    Prisma.sql`SELECT "id", "orgId", "name", "params", "createdAt" FROM "CapacityScenario" WHERE "id" = ${id} LIMIT 1`,
  );
  return rows[0] ?? null;
}

async function insertScenarioRecord(orgId: string, name: string, params: CapacityScenarioParams): Promise<ScenarioRow> {
  const paramsJson = JSON.stringify(params);
  const rows = await prisma.$queryRaw<ScenarioRow[]>(
    Prisma.sql`INSERT INTO "CapacityScenario" ("orgId", "name", "params") VALUES (${orgId}, ${name}, ${paramsJson}::jsonb) RETURNING "id", "orgId", "name", "params", "createdAt"`,
  );
  return rows[0];
}

async function updateScenarioRecord(id: string, name: string, params: CapacityScenarioParams): Promise<ScenarioRow> {
  const paramsJson = JSON.stringify(params);
  const rows = await prisma.$queryRaw<ScenarioRow[]>(
    Prisma.sql`UPDATE "CapacityScenario" SET "name" = ${name}, "params" = ${paramsJson}::jsonb WHERE "id" = ${id} RETURNING "id", "orgId", "name", "params", "createdAt"`,
  );
  return rows[0];
}

export default router;



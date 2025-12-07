import { Router, Request, Response } from 'express';
import { PrismaClient, TrustEntityType, AccreditationStatus } from '@prisma/client';
import { listTrustRegistryEntries } from '../../../../services/trust/models/TrustRegistry.js';
import { seedGlobalTrustRegistry } from '../../../../services/trust/resolver/trustedIssuerGraph.js';

const router = Router();
const prisma = new PrismaClient();

const enumKeys = <T>(enumeration: T) => Object.keys(enumeration) as Array<keyof T>;

function coerceEnumQuery<T>(
  raw: string | string[] | undefined,
  enumeration: Record<string, T>
): T | T[] | undefined {
  if (!raw) return undefined;
  const values = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0)
    .map((value) => {
      if (value in enumeration) {
        return enumeration[value as keyof typeof enumeration];
      }
      return undefined;
    })
    .filter((value): value is T => Boolean(value));

  if (values.length === 0) {
    return undefined;
  }
  if (values.length === 1) {
    return values[0];
  }
  return values;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    // Ensure global anchors exist for demo instances
    await seedGlobalTrustRegistry(prisma);

    const entityType = coerceEnumQuery(req.query.entityType, TrustEntityType);
    const accreditationStatus = coerceEnumQuery(req.query.accreditationStatus, AccreditationStatus);
    const jurisdiction = typeof req.query.jurisdiction === 'string' ? req.query.jurisdiction : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const entries = await listTrustRegistryEntries(prisma, {
      entityType: entityType as any,
      jurisdiction,
      accreditationStatus: accreditationStatus as any,
      search,
    });

    return res.status(200).json({
      items: entries,
      total: entries.length,
      filters: {
        entityType: entityType || null,
        jurisdiction: jurisdiction || null,
        accreditationStatus: accreditationStatus || null,
        search: search || null,
        supportedEntityTypes: enumKeys(TrustEntityType),
        supportedAccreditationStatuses: enumKeys(AccreditationStatus),
      },
    });
  } catch (error) {
    console.error('[Trust Registry] Failed to list entries', error);
    return res.status(500).json({
      error: 'trust_registry_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


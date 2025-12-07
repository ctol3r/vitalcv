/**
 * PSV (Provider Source Verification) collector
 * Collects active PSV connector and source metadata
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');

export interface PsvSourceState {
  activeSources: string[];
  connectors: string[];
  totalSources: number;
  lastSync?: string;
}

export async function collectPsvSources(
  prisma: PrismaClient
): Promise<PsvSourceState> {
  const activeSources: string[] = [];
  const connectors: string[] = [];

  // Scan for PSV-related services and routes
  const servicesDir = path.join(MONOREPO_ROOT, 'apps/api/src/services');
  if (fs.existsSync(servicesDir)) {
    const scanForPsv = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.toLowerCase().includes('psv') ||
              entry.name.toLowerCase().includes('verification') ||
              entry.name.toLowerCase().includes('source')) {
            connectors.push(entry.name);
          }
          scanForPsv(fullPath);
        }
      }
    };
    scanForPsv(servicesDir);
  }

  // Try to query PSV sources from database
  let totalSources = 0;
  let lastSync: string | undefined;

  try {
    const sourceCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "PsvSource"
      WHERE "active" = true
    `.catch(() => [{ count: 0n }]);
    totalSources = Number(sourceCount[0]?.count || 0);

    const lastSyncResult = await prisma.$queryRaw<Array<{ lastSync: Date }>>`
      SELECT MAX("lastSync") as "lastSync"
      FROM "PsvSource"
    `.catch(() => []);
    lastSync = lastSyncResult[0]?.lastSync?.toISOString();

    const sources = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT DISTINCT "name"
      FROM "PsvSource"
      WHERE "active" = true
      LIMIT 20
    `.catch(() => []);
    activeSources.push(...sources.map(s => s.name));
  } catch (error) {
    // Ignore if tables don't exist
  }

  return {
    activeSources: [...new Set(activeSources)],
    connectors: [...new Set(connectors)],
    totalSources,
    lastSync,
  };
}


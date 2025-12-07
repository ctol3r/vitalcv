/**
 * FHIR gateway resources collector
 * Collects FHIR-related service metadata
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');

export interface FhirResourceState {
  resources: string[];
  totalResources: number;
  endpoints: string[];
  conformanceStatement?: boolean;
  gatewayActive: boolean;
}

export async function collectFhirResources(
  prisma: PrismaClient
): Promise<FhirResourceState> {
  const resources: string[] = [];
  const endpoints: string[] = [];

  // Scan FHIR routes
  const fhirRoutesDir = path.join(MONOREPO_ROOT, 'apps/api/src/routes/fhir');
  if (fs.existsSync(fhirRoutesDir)) {
    const files = fs.readdirSync(fhirRoutesDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.ts')) {
        const resourceName = file.name.replace('.ts', '');
        resources.push(resourceName);
        endpoints.push(`/api/fhir/${resourceName}`);
      }
    }
  }

  // Check for conformance statement
  const conformanceFile = path.join(fhirRoutesDir, 'conformance.ts');
  const conformanceStatement = fs.existsSync(conformanceFile);

  // Try to query FHIR-related data
  let totalResources = 0;
  try {
    const resourceCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "FhirResource"
    `.catch(() => [{ count: 0n }]);
    totalResources = Number(resourceCount[0]?.count || 0);
  } catch (error) {
    // Ignore if table doesn't exist
  }

  return {
    resources: [...new Set(resources)],
    totalResources,
    endpoints: [...new Set(endpoints)],
    conformanceStatement,
    gatewayActive: fs.existsSync(fhirRoutesDir),
  };
}


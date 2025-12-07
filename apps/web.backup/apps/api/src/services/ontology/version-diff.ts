import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Ontology version diff tool
 * Tracks ontology evolution
 */

export interface OntologyDiff {
  versionA: number;
  versionB: number;
  changes: {
    added: Record<string, any>;
    removed: Record<string, any>;
    modified: Record<string, { before: any; after: any }>;
  };
  summary: {
    totalChanges: number;
    additions: number;
    removals: number;
    modifications: number;
  };
}

export async function ontologyVersionDiff(versionA: number, versionB: number): Promise<OntologyDiff> {
  const [ontologyA, ontologyB] = await Promise.all([
    prisma.globalClinicianOntology.findFirst({ where: { version: versionA } }),
    prisma.globalClinicianOntology.findFirst({ where: { version: versionB } }),
  ]);

  if (!ontologyA || !ontologyB) {
    throw new Error(`One or both ontology versions not found: ${versionA}, ${versionB}`);
  }

  const dataA = ontologyA.ontology as any;
  const dataB = ontologyB.ontology as any;

  const changes: OntologyDiff['changes'] = {
    added: {},
    removed: {},
    modified: {},
  };

  // Compare credentials
  compareObjects(dataA.credentials || {}, dataB.credentials || {}, 'credentials', changes);

  // Compare specialties
  compareObjects(dataA.specialties || {}, dataB.specialties || {}, 'specialties', changes);

  // Compare roles
  compareObjects(dataA.roles || {}, dataB.roles || {}, 'roles', changes);

  // Compare training paths
  compareObjects(dataA.trainingPaths || {}, dataB.trainingPaths || {}, 'trainingPaths', changes);

  const summary = {
    totalChanges: Object.keys(changes.added).length +
                  Object.keys(changes.removed).length +
                  Object.keys(changes.modified).length,
    additions: Object.keys(changes.added).length,
    removals: Object.keys(changes.removed).length,
    modifications: Object.keys(changes.modified).length,
  };

  return {
    versionA,
    versionB,
    changes,
    summary,
  };
}

function compareObjects(
  objA: Record<string, any>,
  objB: Record<string, any>,
  prefix: string,
  changes: OntologyDiff['changes']
) {
  const keysA = new Set(Object.keys(objA));
  const keysB = new Set(Object.keys(objB));

  // Find added keys
  keysB.forEach(key => {
    if (!keysA.has(key)) {
      changes.added[`${prefix}.${key}`] = objB[key];
    }
  });

  // Find removed keys
  keysA.forEach(key => {
    if (!keysB.has(key)) {
      changes.removed[`${prefix}.${key}`] = objA[key];
    }
  });

  // Find modified keys
  keysA.forEach(key => {
    if (keysB.has(key)) {
      const valA = JSON.stringify(objA[key]);
      const valB = JSON.stringify(objB[key]);
      if (valA !== valB) {
        changes.modified[`${prefix}.${key}`] = {
          before: objA[key],
          after: objB[key],
        };
      }
    }
  });
}









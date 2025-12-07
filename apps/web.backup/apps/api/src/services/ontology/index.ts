import { PrismaClient } from '@prisma/client';
import { specialtyTaxonomyParser } from './taxonomy-parser';
import { credentialToOntologyMapper } from './credential-mapper';
import { specialtyAlignmentEngine } from './specialty-alignment';
import { trainingPathExtractor } from './training-extractor';
import { ontologyInferenceEngine } from './inference';
import { credentialRoleClassifier } from './role-classifier';
import { ontologyVersionDiff } from './version-diff';
import { anchorOntologySnapshot } from './anchor';

const prisma = new PrismaClient();

export interface OntologyData {
  credentials: Record<string, any>;
  specialties: Record<string, any>;
  roles: Record<string, any>;
  trainingPaths: Record<string, any>;
}

/**
 * Get or create the latest ontology version
 */
export async function getLatestOntology(): Promise<{ id: string; ontology: OntologyData; version: number }> {
  const latest = await prisma.globalClinicianOntology.findFirst({
    orderBy: { version: 'desc' },
  });

  if (latest) {
    return {
      id: latest.id,
      ontology: latest.ontology as OntologyData,
      version: latest.version,
    };
  }

  // Create initial ontology
  const initial = await prisma.globalClinicianOntology.create({
    data: {
      ontology: {
        credentials: {},
        specialties: {},
        roles: {},
        trainingPaths: {},
      },
      version: 1,
    },
  });

  return {
    id: initial.id,
    ontology: initial.ontology as OntologyData,
    version: initial.version,
  };
}

/**
 * Update ontology with new data
 */
export async function updateOntology(ontology: Partial<OntologyData>): Promise<{ id: string; version: number }> {
  const latest = await getLatestOntology();
  const merged = {
    credentials: { ...latest.ontology.credentials, ...(ontology.credentials || {}) },
    specialties: { ...latest.ontology.specialties, ...(ontology.specialties || {}) },
    roles: { ...latest.ontology.roles, ...(ontology.roles || {}) },
    trainingPaths: { ...latest.ontology.trainingPaths, ...(ontology.trainingPaths || {}) },
  };

  const updated = await prisma.globalClinicianOntology.create({
    data: {
      ontology: merged,
      version: latest.version + 1,
    },
  });

  return {
    id: updated.id,
    version: updated.version,
  };
}

/**
 * Map credential to ontology primitives
 */
export async function mapCredentialToOntology(credentialId: string, credentialData: any) {
  return credentialToOntologyMapper(credentialId, credentialData);
}

/**
 * Parse specialty taxonomy from multiple countries
 */
export async function parseSpecialtyTaxonomy(specialty: string, country: string) {
  return specialtyTaxonomyParser(specialty, country);
}

/**
 * Align specialties across different systems
 */
export async function alignSpecialties(specialtyA: string, specialtyB: string, countryA: string, countryB: string) {
  return specialtyAlignmentEngine(specialtyA, specialtyB, countryA, countryB);
}

/**
 * Extract training path from credential history
 */
export async function extractTrainingPath(clinicianId: string, credentials: any[]) {
  return trainingPathExtractor(clinicianId, credentials);
}

/**
 * Infer missing ontology links using AI
 */
export async function inferOntologyLinks(partialData: Partial<OntologyData>) {
  return ontologyInferenceEngine(partialData);
}

/**
 * Classify credential to role eligibility
 */
export async function classifyCredentialToRole(credentialId: string, credentialData: any) {
  return credentialRoleClassifier(credentialId, credentialData);
}

/**
 * Get diff between ontology versions
 */
export async function getOntologyVersionDiff(versionA: number, versionB: number) {
  return ontologyVersionDiff(versionA, versionB);
}

/**
 * Anchor ontology snapshot
 */
export async function anchorOntology(version: number) {
  const ontology = await prisma.globalClinicianOntology.findFirst({
    where: { version },
  });

  if (!ontology) {
    throw new Error(`Ontology version ${version} not found`);
  }

  return anchorOntologySnapshot(ontology);
}

export {
  specialtyTaxonomyParser,
  credentialToOntologyMapper,
  specialtyAlignmentEngine,
  trainingPathExtractor,
  ontologyInferenceEngine,
  credentialRoleClassifier,
  ontologyVersionDiff,
  anchorOntologySnapshot,
};









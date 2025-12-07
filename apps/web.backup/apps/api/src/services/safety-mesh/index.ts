import { PrismaClient } from '@prisma/client';
import { sanctionsMeshIngestion } from './sanctions-ingestion';
import { riskHarmonizer } from './risk-harmonizer';
import { riskPropagation } from './risk-propagation';
import { meshValidator } from './validator';
import { trustSignalEngine } from './trust-signals';
import { predictionModel } from './prediction';
import { auditExport } from './audit-export';
import { anchorSafetyMesh } from './anchor';

const prisma = new PrismaClient();

export interface SafetyMeshData {
  sanctions: any[];
  safetyEvents: any[];
  regulators: any[];
  boards: any[];
  employers: any[];
}

/**
 * Get or create the safety compliance mesh
 */
export async function getSafetyMesh(): Promise<{ id: string; mesh: SafetyMeshData }> {
  const existing = await prisma.safetyComplianceMesh.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return {
      id: existing.id,
      mesh: existing.mesh as SafetyMeshData,
    };
  }

  const created = await prisma.safetyComplianceMesh.create({
    data: {
      mesh: {
        sanctions: [],
        safetyEvents: [],
        regulators: [],
        boards: [],
        employers: [],
      },
    },
  });

  return {
    id: created.id,
    mesh: created.mesh as SafetyMeshData,
  };
}

/**
 * Update safety mesh
 */
export async function updateSafetyMesh(mesh: Partial<SafetyMeshData>): Promise<{ id: string }> {
  const existing = await getSafetyMesh();
  const merged: SafetyMeshData = {
    sanctions: mesh.sanctions || existing.mesh.sanctions,
    safetyEvents: mesh.safetyEvents || existing.mesh.safetyEvents,
    regulators: mesh.regulators || existing.mesh.regulators,
    boards: mesh.boards || existing.mesh.boards,
    employers: mesh.employers || existing.mesh.employers,
  };

  const updated = await prisma.safetyComplianceMesh.update({
    where: { id: existing.id },
    data: { mesh: merged },
  });

  return { id: updated.id };
}

/**
 * Ingest real-time sanctions data
 */
export async function ingestSanctions(sources: string[]) {
  return sanctionsMeshIngestion(sources);
}

/**
 * Harmonize risk levels across jurisdictions
 */
export async function harmonizeRisk(riskEvents: any[]) {
  return riskHarmonizer(riskEvents);
}

/**
 * Propagate risk events to employers
 */
export async function propagateRisk(clinicianId: string, riskEvent: any, employerIds: string[]) {
  return riskPropagation(clinicianId, riskEvent, employerIds);
}

/**
 * Validate mesh compliance
 */
export async function validateMesh() {
  return meshValidator();
}

/**
 * Calculate trust signals for mesh sources
 */
export async function calculateTrustSignals() {
  return trustSignalEngine();
}

/**
 * Predict future safety events
 */
export async function predictSafetyEvents(clinicianId?: string) {
  return predictionModel(clinicianId);
}

/**
 * Export audit evidence pack
 */
export async function exportAuditPack(clinicianId: string) {
  return auditExport(clinicianId);
}

/**
 * Anchor safety mesh snapshot
 */
export async function anchorMesh() {
  const mesh = await prisma.safetyComplianceMesh.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!mesh) {
    throw new Error('Safety mesh not found');
  }

  return anchorSafetyMesh(mesh);
}

export {
  sanctionsMeshIngestion,
  riskHarmonizer,
  riskPropagation,
  meshValidator,
  trustSignalEngine,
  predictionModel,
  auditExport,
  anchorSafetyMesh,
};









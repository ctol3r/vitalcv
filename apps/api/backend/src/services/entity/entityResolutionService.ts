/**
 * entityResolutionService.ts — Canonical entity resolution
 *
 * The entry point for everything entity-related. Given an NPI (or entity ID),
 * returns a fully resolved VcvEntity with roles, credentials, and relationships.
 *
 * This is the service that makes the system real — it bridges NPPES/OIG/PECOS
 * raw data into typed, persisted, queryable entity records.
 *
 * Flow:
 *   1. resolveNpi() → NPPES lookup → NpiResolution
 *   2. upsert VcvEntity with canonical ID
 *   3. assign initial roles from NPI type
 *   4. return EntityRecord with roles + routing decision
 */

import prisma from '../../graphql/prisma_client';
import { resolveNpi, deriveCanonicalId, buildEntityFromNppesRecord } from '../../domain/entity/npiRouter';
import { log } from '../../obs/logger';
import type { VcvEntity, VcvEntityRole, VcvEntityRelationship, VcvCredential } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntityRecord {
  entity:        VcvEntity;
  roles:         VcvEntityRole[];
  relationships: VcvEntityRelationship[];
  credentials:   VcvCredential[];
  routingEntry:  string;
  subjectLabel:  string;
}

export interface EntitySummary {
  id:           string;
  entityType:   string;
  displayName:  string;
  npi?:         string;
  npiType?:     string;
  primaryRole:  string;
  routingEntry: string;
  verifiedAt?:  string;
  metadata:     Record<string, unknown>;
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve an NPI to a canonical entity.
 * Creates the entity if it doesn't exist; updates if NPPES data changed.
 * Returns the full EntityRecord.
 */
export async function resolveEntityFromNpi(npi: string): Promise<EntityRecord> {
  // 1. Resolve from NPPES
  const resolution = await resolveNpi(npi);

  // 2. Upsert entity
  const canonicalId = deriveCanonicalId(resolution.entityType, npi);
  const entityTypeEnum = resolution.entityType === 'organization' ? 'ORGANIZATION' : 'PERSON';

  const entity = await prisma.vcvEntity.upsert({
    where:  { canonicalId },
    create: {
      canonicalId,
      entityType:  entityTypeEnum,
      displayName: resolution.displayName,
      npi,
      npiType:     resolution.npiType,
      sourceIds:   ['NPPES_API'],
      verifiedAt:  new Date(),
      metadata: {
        specialty:      resolution.specialty,
        credentials:    resolution.credentials,
        taxonomies:     resolution.taxonomies,
        enumerationDate: resolution.enumerationDate,
        lastUpdated:    resolution.lastUpdated,
        address:        resolution.address,
        status:         resolution.status,
        enumerationType: resolution.enumerationType,
      } as import('@prisma/client').Prisma.InputJsonValue,
    },
    update: {
      displayName: resolution.displayName,
      verifiedAt:  new Date(),
      metadata: {
        specialty:      resolution.specialty,
        credentials:    resolution.credentials,
        taxonomies:     resolution.taxonomies,
        enumerationDate: resolution.enumerationDate,
        lastUpdated:    resolution.lastUpdated,
        address:        resolution.address,
        status:         resolution.status,
        enumerationType: resolution.enumerationType,
      } as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  // 3. Assign initial role if none exists
  const existingRoles = await prisma.vcvEntityRole.findMany({
    where: { entityId: entity.id },
  });

  if (existingRoles.length === 0) {
    const primaryRole = resolution.npiType === 'TYPE_2' ? 'EMPLOYER' : 'CLINICIAN';
    await prisma.vcvEntityRole.create({
      data: {
        entityId:  entity.id,
        roleType:  primaryRole,
        source:    'NPPES_DERIVED',
        context:   resolution.specialty ?? null,
      },
    });
  }

  // 4. Fetch relationships and credentials
  const [roles, relationships, credentials] = await Promise.all([
    prisma.vcvEntityRole.findMany({ where: { entityId: entity.id } }),
    prisma.vcvEntityRelationship.findMany({
      where: { OR: [{ subjectId: entity.id }, { objectId: entity.id }] },
      take: 50,
    }),
    prisma.vcvCredential.findMany({
      where:   { subjectId: entity.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const routing = resolution.routingDecision;

  log('info', 'entity_resolved', {
    id: entity.id, npi, entityType: entity.entityType,
    roles: roles.length, credentials: credentials.length,
  });

  return {
    entity,
    roles,
    relationships,
    credentials,
    routingEntry: routing?.workflowEntry ?? '/get-ready',
    subjectLabel: routing?.subjectLabel  ?? 'Provider',
  };
}

/**
 * Get a full entity record by internal ID.
 */
export async function getEntityById(id: string): Promise<EntityRecord | null> {
  const entity = await prisma.vcvEntity.findUnique({ where: { id } });
  if (!entity) return null;

  const [roles, relationships, credentials] = await Promise.all([
    prisma.vcvEntityRole.findMany({ where: { entityId: id } }),
    prisma.vcvEntityRelationship.findMany({
      where: { OR: [{ subjectId: id }, { objectId: id }] },
      take: 50,
    }),
    prisma.vcvCredential.findMany({
      where:   { subjectId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const npiType        = entity.npiType;
  const isOrg          = npiType === 'TYPE_2';
  const routingEntry   = isOrg ? '/employers' : '/get-ready';
  const subjectLabel   = isOrg ? 'Organization / Group Practice' : 'Individual Provider';

  return { entity, roles, relationships, credentials, routingEntry, subjectLabel };
}

/**
 * Build a compact EntitySummary from a full record (for list views).
 */
export function toEntitySummary(record: EntityRecord): EntitySummary {
  const { entity, roles } = record;
  const primary = roles.find(r => r.source === 'NPPES_DERIVED') ?? roles[0];
  const meta = entity.metadata as Record<string, unknown>;

  return {
    id:           entity.id,
    entityType:   entity.entityType,
    displayName:  entity.displayName,
    npi:          entity.npi ?? undefined,
    npiType:      entity.npiType ?? undefined,
    primaryRole:  primary?.roleType ?? 'CLINICIAN',
    routingEntry: record.routingEntry,
    verifiedAt:   entity.verifiedAt?.toISOString(),
    metadata: {
      specialty: meta.specialty,
      status:    meta.status,
    },
  };
}

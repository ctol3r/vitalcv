/**
 * S72-POST-2A-005: Public-safe ID mapping service
 *
 * Hides internal incremental database IDs behind public-safe identifiers (UUID or ULID).
 * This prevents information leakage about database structure and prevents enumeration attacks.
 *
 * Public APIs should return publicId (UUID/ULID) instead of internal DB ids.
 * Mapping tables or columns store the relationship between publicId and internal id.
 */

import { randomUUID } from 'crypto';

/**
 * Public-safe ID type (UUID v4)
 */
export type PublicId = string;

/**
 * Internal database ID type (could be integer or string)
 */
export type InternalId = string | number;

/**
 * ID mapping record stored in database
 */
export interface IdMapping {
  id: string; // Internal mapping ID
  publicId: PublicId; // Public-safe identifier (UUID)
  internalId: InternalId; // Internal database ID
  entityType: EntityType; // Type of entity (e.g., 'Application', 'PrivilegeRequest')
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supported entity types for ID mapping
 */
export enum EntityType {
  APPLICATION = 'Application',
  PRIVILEGE_REQUEST = 'PrivilegeRequest',
  JOB_POSTING = 'JobPosting',
  PAYER_ENROLLMENT = 'PayerEnrollment',
  CLINICIAN = 'Clinician', // Note: Clinicians use DID, but may need public ID for some APIs
  ORGANIZATION = 'Organization',
  PRIVILEGE_SET = 'PrivilegeSet',
}

/**
 * Generate a new public-safe UUID
 */
export function generatePublicId(): PublicId {
  return randomUUID();
}

/**
 * S72-POST-2A-005: Create a mapping between public ID and internal ID
 *
 * In production, this should store the mapping in a database table.
 * For MVP, we'll use a simple in-memory cache (replace with database persistence).
 *
 * @param entityType Type of entity
 * @param internalId Internal database ID
 * @returns Public-safe UUID
 */
export async function createIdMapping(
  entityType: EntityType,
  internalId: InternalId
): Promise<PublicId> {
  const publicId = generatePublicId();

  // TODO: In production, store mapping in database table:
  // INSERT INTO IdMapping (publicId, internalId, entityType) VALUES (publicId, internalId, entityType)

  // For MVP: Use in-memory cache (replace with database)
  const mapping: IdMapping = {
    id: generatePublicId(),
    publicId,
    internalId: String(internalId),
    entityType,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store in cache (replace with database in production)
  idMappingCache.set(publicId, mapping);
  reverseMappingCache.set(`${entityType}:${internalId}`, publicId);

  return publicId;
}

/**
 * S72-POST-2A-005: Get internal ID from public ID
 *
 * @param publicId Public-safe UUID
 * @param entityType Optional entity type for validation
 * @returns Internal database ID, or null if not found
 */
export async function getInternalId(
  publicId: PublicId,
  entityType?: EntityType
): Promise<InternalId | null> {
  // TODO: In production, query database:
  // SELECT internalId FROM IdMapping WHERE publicId = ? AND entityType = ?

  // For MVP: Use in-memory cache
  const mapping = idMappingCache.get(publicId);

  if (!mapping) {
    return null;
  }

  if (entityType && mapping.entityType !== entityType) {
    throw new Error(`ID mapping type mismatch: expected ${entityType}, got ${mapping.entityType}`);
  }

  return mapping.internalId;
}

/**
 * S72-POST-2A-005: Get public ID from internal ID
 *
 * @param internalId Internal database ID
 * @param entityType Entity type
 * @returns Public-safe UUID, or null if not found
 */
export async function getPublicId(
  internalId: InternalId,
  entityType: EntityType
): Promise<PublicId | null> {
  // TODO: In production, query database:
  // SELECT publicId FROM IdMapping WHERE internalId = ? AND entityType = ?

  // For MVP: Use in-memory cache
  const publicId = reverseMappingCache.get(`${entityType}:${internalId}`);
  return publicId || null;
}

/**
 * S72-POST-2A-005: Convert internal entity to public-safe entity
 *
 * Replaces internal IDs with public IDs in entity objects.
 *
 * @param entity Entity object with internal IDs
 * @param entityType Type of entity
 * @returns Entity object with public IDs
 */
export async function toPublicEntity<T extends { id: InternalId }>(
  entity: T,
  entityType: EntityType
): Promise<Omit<T, 'id'> & { id: PublicId; publicId: PublicId }> {
  const publicId = await getPublicId(entity.id, entityType) || await createIdMapping(entityType, entity.id);

  const { id: _internalId, ...rest } = entity;
  return {
    ...rest,
    id: publicId,
    publicId, // Include both for backwards compatibility
  } as Omit<T, 'id'> & { id: PublicId; publicPublicId: PublicId };
}

/**
 * S72-POST-2A-005: Convert public entity back to internal entity (for database operations)
 *
 * @param publicEntity Entity object with public IDs
 * @param entityType Type of entity
 * @returns Entity object with internal IDs
 */
export async function toInternalEntity<T extends { id: PublicId }>(
  publicEntity: T,
  entityType: EntityType
): Promise<Omit<T, 'id'> & { id: InternalId }> {
  const internalId = await getInternalId(publicEntity.id, entityType);

  if (!internalId) {
    throw new Error(`Public ID not found: ${publicEntity.id} for entity type ${entityType}`);
  }

  const { id: _publicId, ...rest } = publicEntity;
  return {
    ...rest,
    id: internalId,
  } as Omit<T, 'id'> & { id: InternalId };
}

// =====================================================
// In-memory cache (replace with database in production)
// =====================================================

/**
 * In-memory cache for ID mappings (publicId -> mapping)
 * In production, replace with database table.
 */
const idMappingCache = new Map<PublicId, IdMapping>();

/**
 * Reverse cache for ID mappings (entityType:internalId -> publicId)
 * In production, replace with database table with index.
 */
const reverseMappingCache = new Map<string, PublicId>();

/**
 * S72-POST-2A-005: Database migration should create this table:
 *
 * CREATE TABLE "IdMapping" (
 *   "id" TEXT NOT NULL PRIMARY KEY,
 *   "publicId" TEXT NOT NULL UNIQUE,
 *   "internalId" TEXT NOT NULL,
 *   "entityType" TEXT NOT NULL,
 *   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   CONSTRAINT "IdMapping_publicId_key" UNIQUE ("publicId"),
 *   CONSTRAINT "IdMapping_entity_internal_unique" UNIQUE ("entityType", "internalId")
 * );
 *
 * CREATE INDEX "IdMapping_publicId_idx" ON "IdMapping"("publicId");
 * CREATE INDEX "IdMapping_internalId_idx" ON "IdMapping"("entityType", "internalId");
 */


/**
 * CLAIM SCHEMA REGISTRY
 *
 * Centralized registry for claim type schemas
 * Thread-safe, immutable after registration
 */

import {
  ClaimSchema,
  ClaimType,
  SchemaRegistryError,
  createClaimType,
} from './types';

/**
 * Schema Registry - stores and retrieves claim schemas
 *
 * Design:
 * - Immutable after registration (schemas cannot be modified)
 * - Thread-safe (Map operations are atomic)
 * - Fail-fast (throws on duplicate registration)
 */
export class SchemaRegistry {
  private readonly schemas: Map<string, Readonly<ClaimSchema>>;

  constructor() {
    this.schemas = new Map<string, Readonly<ClaimSchema>>();
  }

  /**
   * Register a new claim schema
   *
   * @param schema - Claim schema to register
   * @throws SchemaRegistryError if schema already registered
   */
  register(schema: ClaimSchema): void {
    if (this.schemas.has(schema.type)) {
      throw new SchemaRegistryError(
        `Schema for type "${schema.type}" is already registered`
      );
    }

    // Freeze schema to ensure immutability
    const frozenSchema = Object.freeze({ ...schema });
    this.schemas.set(schema.type, frozenSchema);
  }

  /**
   * Register multiple schemas at once
   *
   * @param schemas - Array of schemas to register
   * @throws SchemaRegistryError if any schema already registered
   */
  registerAll(schemas: ReadonlyArray<ClaimSchema>): void {
    // Validate all schemas first (fail-fast before any registration)
    for (const schema of schemas) {
      if (this.schemas.has(schema.type)) {
        throw new SchemaRegistryError(
          `Schema for type "${schema.type}" is already registered`
        );
      }
    }

    // Register all schemas
    for (const schema of schemas) {
      this.register(schema);
    }
  }

  /**
   * Get schema for claim type
   *
   * @param type - Claim type
   * @returns Schema if registered
   * @throws SchemaRegistryError if schema not found
   */
  get(type: ClaimType): Readonly<ClaimSchema> {
    const schema = this.schemas.get(type);

    if (!schema) {
      throw new SchemaRegistryError(
        `No schema registered for type "${type}"`
      );
    }

    return schema;
  }

  /**
   * Check if schema is registered
   *
   * @param type - Claim type
   * @returns true if schema registered
   */
  has(type: ClaimType): boolean {
    return this.schemas.has(type);
  }

  /**
   * Get all registered claim types
   *
   * @returns Array of claim types
   */
  listTypes(): ReadonlyArray<ClaimType> {
    return Array.from(this.schemas.keys()) as ClaimType[];
  }

  /**
   * Get all registered schemas
   *
   * @returns Array of schemas
   */
  listSchemas(): ReadonlyArray<Readonly<ClaimSchema>> {
    return Array.from(this.schemas.values());
  }

  /**
   * Clear all registered schemas (USE WITH CAUTION)
   * Primarily for testing
   */
  clear(): void {
    this.schemas.clear();
  }

  /**
   * Get count of registered schemas
   */
  get size(): number {
    return this.schemas.size;
  }
}

/**
 * Global singleton registry
 * Use this for application-wide schema registration
 */
export const globalRegistry = new SchemaRegistry();

/**
 * Helper: Register standard healthcare claim schemas
 */
export function registerStandardSchemas(registry: SchemaRegistry = globalRegistry): void {
  const standardSchemas: ClaimSchema[] = [
    {
      type: createClaimType('npi'),
      description: 'National Provider Identifier',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'PAYMENT', 'OPERATIONS', 'HOPER'],
    },
    {
      type: createClaimType('medical_license'),
      description: 'State Medical License Number',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'OPERATIONS', 'HOPER'],
    },
    {
      type: createClaimType('dea_number'),
      description: 'DEA Registration Number',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'OPERATIONS'],
    },
    {
      type: createClaimType('board_certification'),
      description: 'Board Certification',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'OPERATIONS', 'HOPER'],
    },
    {
      type: createClaimType('specialty'),
      description: 'Medical Specialty',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'PAYMENT', 'OPERATIONS', 'HOPER'],
    },
    {
      type: createClaimType('hospital_privileges'),
      description: 'Hospital Privileges',
      hash_algorithm: 'sha256',
      allowed_purposes: ['TREATMENT', 'OPERATIONS'],
    },
  ];

  registry.registerAll(standardSchemas);
}

/**
 * B228A-LIN-004: TransformationRegistry
 *
 * Catalogs all data transformations (functions, AI models) used in the platform.
 * Assigns stable transformationIds. Stores version, description, risk classification.
 */

import { PrismaClient, RiskClassification } from '@prisma/client';
import { z } from 'zod';
import { createHash } from 'crypto';

export const TransformationRegistrySchema = z.object({
  transformationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  riskClassification: z.nativeEnum(RiskClassification),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TransformationRegistry = z.infer<typeof TransformationRegistrySchema>;

export interface CreateTransformationInput {
  name: string;
  description?: string | null;
  version?: string;
  riskClassification?: RiskClassification;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateTransformationInput {
  name?: string;
  description?: string | null;
  version?: string;
  riskClassification?: RiskClassification;
  metadata?: Record<string, unknown> | null;
}

export interface TransformationQuery {
  name?: string;
  riskClassification?: RiskClassification;
  version?: string;
  limit?: number;
  offset?: number;
}

/**
 * Generate stable transformation ID from name and version
 */
function generateTransformationId(name: string, version: string): string {
  const input = `${name}:${version}`;
  const hash = createHash('sha256').update(input).digest('hex');
  // Use first 16 characters of hash as stable ID
  return `trans_${hash.substring(0, 16)}`;
}

/**
 * TransformationRegistry service
 */
export class TransformationRegistryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new transformation
   */
  async registerTransformation(input: CreateTransformationInput): Promise<TransformationRegistry> {
    const version = input.version || '1.0.0';
    const transformationId = generateTransformationId(input.name, version);

    // Check if transformation already exists
    const existing = await this.prisma.transformationRegistry.findUnique({
      where: { transformationId },
    });

    if (existing) {
      // Update existing transformation
      const updated = await this.prisma.transformationRegistry.update({
        where: { transformationId },
        data: {
          name: input.name,
          description: input.description ?? null,
          version,
          riskClassification: input.riskClassification || RiskClassification.MEDIUM,
          metadata: input.metadata ?? null,
          updatedAt: new Date(),
        },
      });

      return TransformationRegistrySchema.parse(updated);
    }

    // Create new transformation
    const transformation = await this.prisma.transformationRegistry.create({
      data: {
        transformationId,
        name: input.name,
        description: input.description ?? null,
        version,
        riskClassification: input.riskClassification || RiskClassification.MEDIUM,
        metadata: input.metadata ?? null,
      },
    });

    return TransformationRegistrySchema.parse(transformation);
  }

  /**
   * Update an existing transformation
   */
  async updateTransformation(
    transformationId: string,
    input: UpdateTransformationInput
  ): Promise<TransformationRegistry> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.version !== undefined) {
      updateData.version = input.version;
    }
    if (input.riskClassification !== undefined) {
      updateData.riskClassification = input.riskClassification;
    }
    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
    }

    const updated = await this.prisma.transformationRegistry.update({
      where: { transformationId },
      data: updateData,
    });

    return TransformationRegistrySchema.parse(updated);
  }

  /**
   * Get transformation by ID
   */
  async getTransformation(transformationId: string): Promise<TransformationRegistry | null> {
    const transformation = await this.prisma.transformationRegistry.findUnique({
      where: { transformationId },
    });

    if (!transformation) {
      return null;
    }

    return TransformationRegistrySchema.parse(transformation);
  }

  /**
   * Query transformations
   */
  async queryTransformations(query: TransformationQuery): Promise<TransformationRegistry[]> {
    const where: any = {};

    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }

    if (query.riskClassification) {
      where.riskClassification = query.riskClassification;
    }

    if (query.version) {
      where.version = query.version;
    }

    const transformations = await this.prisma.transformationRegistry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return transformations.map((t) => TransformationRegistrySchema.parse(t));
  }

  /**
   * Get transformation by name and version
   */
  async getTransformationByName(
    name: string,
    version: string = '1.0.0'
  ): Promise<TransformationRegistry | null> {
    const transformationId = generateTransformationId(name, version);
    return this.getTransformation(transformationId);
  }

  /**
   * List all transformations
   */
  async listTransformations(limit = 100, offset = 0): Promise<TransformationRegistry[]> {
    return this.queryTransformations({ limit, offset });
  }

  /**
   * Get transformations by risk classification
   */
  async getTransformationsByRisk(
    riskClassification: RiskClassification,
    limit = 100
  ): Promise<TransformationRegistry[]> {
    return this.queryTransformations({ riskClassification, limit });
  }

  /**
   * Delete transformation (soft delete by setting risk to CRITICAL and marking as deprecated)
   */
  async deprecateTransformation(transformationId: string): Promise<void> {
    await this.prisma.transformationRegistry.update({
      where: { transformationId },
      data: {
        riskClassification: RiskClassification.CRITICAL,
        metadata: {
          deprecated: true,
          deprecatedAt: new Date().toISOString(),
        },
      },
    });
  }
}

// Export singleton instance
const prisma = new PrismaClient();
export const transformationRegistry = new TransformationRegistryService(prisma);


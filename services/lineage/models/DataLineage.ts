/**
 * B228A-LIN-001: DataLineage model
 *
 * Tracks data lineage: sourceSystem, sourceRecordId, targetRecordId, operationType,
 * timestamp, operatorId, transformationId, metadata.
 */

import { PrismaClient, OperationType } from '@prisma/client';
import { z } from 'zod';

export const DataLineageSchema = z.object({
  id: z.string(),
  sourceSystem: z.string(),
  sourceRecordId: z.string(),
  targetRecordId: z.string(),
  operationType: z.nativeEnum(OperationType),
  timestamp: z.date(),
  operatorId: z.string().nullable(),
  transformationId: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export type DataLineage = z.infer<typeof DataLineageSchema>;

export interface CreateDataLineageInput {
  sourceSystem: string;
  sourceRecordId: string;
  targetRecordId: string;
  operationType: OperationType;
  operatorId?: string | null;
  transformationId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface LineageQuery {
  sourceSystem?: string;
  sourceRecordId?: string;
  targetRecordId?: string;
  operationType?: OperationType;
  operatorId?: string;
  transformationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * DataLineage service
 */
export class DataLineageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a lineage entry
   */
  async createLineage(input: CreateDataLineageInput): Promise<DataLineage> {
    const lineage = await this.prisma.dataLineage.create({
      data: {
        sourceSystem: input.sourceSystem,
        sourceRecordId: input.sourceRecordId,
        targetRecordId: input.targetRecordId,
        operationType: input.operationType,
        operatorId: input.operatorId ?? null,
        transformationId: input.transformationId ?? null,
        metadata: input.metadata ?? null,
        timestamp: new Date(),
      },
    });

    return DataLineageSchema.parse(lineage);
  }

  /**
   * Query lineage entries
   */
  async queryLineage(query: LineageQuery): Promise<DataLineage[]> {
    const where: any = {};

    if (query.sourceSystem) {
      where.sourceSystem = query.sourceSystem;
    }

    if (query.sourceRecordId) {
      where.sourceRecordId = query.sourceRecordId;
    }

    if (query.targetRecordId) {
      where.targetRecordId = query.targetRecordId;
    }

    if (query.operationType) {
      where.operationType = query.operationType;
    }

    if (query.operatorId) {
      where.operatorId = query.operatorId;
    }

    if (query.transformationId) {
      where.transformationId = query.transformationId;
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = query.startDate;
      }
      if (query.endDate) {
        where.timestamp.lte = query.endDate;
      }
    }

    const entries = await this.prisma.dataLineage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return entries.map((entry) => DataLineageSchema.parse(entry));
  }

  /**
   * Get forward lineage (what was created/updated from this record)
   */
  async getForwardLineage(recordId: string, limit = 100): Promise<DataLineage[]> {
    return this.queryLineage({ sourceRecordId: recordId, limit });
  }

  /**
   * Get backward lineage (what created/updated this record)
   */
  async getBackwardLineage(recordId: string, limit = 100): Promise<DataLineage[]> {
    return this.queryLineage({ targetRecordId: recordId, limit });
  }

  /**
   * Get all lineage for a record (both forward and backward)
   */
  async getFullLineage(recordId: string, limit = 100): Promise<{
    forward: DataLineage[];
    backward: DataLineage[];
  }> {
    const [forward, backward] = await Promise.all([
      this.getForwardLineage(recordId, limit),
      this.getBackwardLineage(recordId, limit),
    ]);

    return { forward, backward };
  }
}


/**
 * Snapshot Archival System
 * Stores state-agent outputs in Postgres + S3 (if available)
 */

import type { PrismaClient } from '@prisma/client';
import type { StateReport } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SnapshotMetadata {
  id: string;
  waveNumber?: number;
  timestamp: string;
  commitHash?: string;
  snapshotPath: string;
  jsonPath?: string;
  markdownPath?: string;
  subsystemDeltas?: Record<string, any>;
}

/**
 * Save snapshot to database
 * Requires StateSnapshot table in Prisma schema
 */
export async function saveSnapshotToDatabase(
  prisma: PrismaClient,
  report: StateReport,
  metadata: Omit<SnapshotMetadata, 'id' | 'snapshotPath'>
): Promise<string | null> {
  try {
    // Try to insert into StateSnapshot table
    // Note: This assumes the table exists. If not, it will fail gracefully.
    const result = await prisma.$executeRaw<Array<{ id: string }>>`
      INSERT INTO "StateSnapshot" (
        "waveNumber",
        "timestamp",
        "commitHash",
        "reportJson",
        "reportMarkdown",
        "subsystemDeltas",
        "createdAt"
      )
      VALUES (
        ${metadata.waveNumber || null},
        ${metadata.timestamp},
        ${metadata.commitHash || null},
        ${JSON.stringify(report)},
        ${report.narrative || ''},
        ${metadata.subsystemDeltas ? JSON.stringify(metadata.subsystemDeltas) : null},
        NOW()
      )
      RETURNING "id"
    ` as any;

    if (result && Array.isArray(result) && result.length > 0) {
      return result[0].id;
    }

    return null;
  } catch (error) {
    // Table might not exist, that's okay
    console.warn('[state-agent] StateSnapshot table not found or insert failed:', error);
    return null;
  }
}

/**
 * Load snapshot from database
 */
export async function loadSnapshotFromDatabase(
  prisma: PrismaClient,
  snapshotId: string
): Promise<StateReport | null> {
  try {
    const result = await prisma.$queryRaw<Array<{
      reportJson: string;
      waveNumber: number | null;
      timestamp: string;
      commitHash: string | null;
    }>>`
      SELECT "reportJson", "waveNumber", "timestamp", "commitHash"
      FROM "StateSnapshot"
      WHERE "id" = ${snapshotId}
      LIMIT 1
    `;

    if (result && result.length > 0) {
      return JSON.parse(result[0].reportJson) as StateReport;
    }

    return null;
  } catch (error) {
    console.warn('[state-agent] Failed to load snapshot from database:', error);
    return null;
  }
}

/**
 * List snapshots from database
 */
export async function listSnapshots(
  prisma: PrismaClient,
  options: {
    waveNumber?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Array<{
  id: string;
  waveNumber: number | null;
  timestamp: string;
  commitHash: string | null;
  createdAt: Date;
}>> {
  try {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let query = `
      SELECT "id", "waveNumber", "timestamp", "commitHash", "createdAt"
      FROM "StateSnapshot"
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.waveNumber !== undefined) {
      conditions.push(`"waveNumber" = $${paramIndex}`);
      params.push(options.waveNumber);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await prisma.$queryRawUnsafe(query, ...params) as Array<{
      id: string;
      waveNumber: number | null;
      timestamp: string;
      commitHash: string | null;
      createdAt: Date;
    }>;

    return result || [];
  } catch (error) {
    console.warn('[state-agent] Failed to list snapshots:', error);
    return [];
  }
}

/**
 * Compare two snapshots to detect subsystem drift
 */
export function compareSnapshots(
  oldSnapshot: StateReport,
  newSnapshot: StateReport
): Record<string, any> {
  const deltas: Record<string, any> = {};

  // Compare API routes
  const oldRoutes = oldSnapshot.metadata.api.routes.length;
  const newRoutes = newSnapshot.metadata.api.routes.length;
  if (oldRoutes !== newRoutes) {
    deltas.apiRoutes = {
      old: oldRoutes,
      new: newRoutes,
      delta: newRoutes - oldRoutes,
    };
  }

  // Compare packages
  const oldPackages = oldSnapshot.metadata.packages.length;
  const newPackages = newSnapshot.metadata.packages.length;
  if (oldPackages !== newPackages) {
    deltas.packages = {
      old: oldPackages,
      new: newPackages,
      delta: newPackages - oldPackages,
    };
  }

  // Compare services
  const oldServices = oldSnapshot.metadata.services.length;
  const newServices = newSnapshot.metadata.services.length;
  if (oldServices !== newServices) {
    deltas.services = {
      old: oldServices,
      new: newServices,
      delta: newServices - oldServices,
    };
  }

  // Compare blockchain pallets
  const oldPallets = oldSnapshot.metadata.blockchain.pallets.length;
  const newPallets = newSnapshot.metadata.blockchain.pallets.length;
  if (oldPallets !== newPallets) {
    deltas.blockchainPallets = {
      old: oldPallets,
      new: newPallets,
      delta: newPallets - oldPallets,
    };
  }

  return deltas;
}


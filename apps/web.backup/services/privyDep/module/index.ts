/**
 * B211B-MK-008: Privilege DAG Engine Microkernel Module
 *
 * Implements DomainModule interface for privilege dependency graph operations.
 * Exposes validatePrivilege(), expandPrivilegeSet(), detectConflicts() via DomainModule interface.
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../../microkernel/types.js';
import { evaluatePrivilegeEligibility, type PrivilegeEligibilityInput, type PrivilegeEligibilityResult } from '../eligibilityEngine.js';
import { detectPrivilegeConflicts, type PrivilegeConflictDetectionResult } from '../detectors/conflictDetector.js';
import { buildPrivilegeGraph } from '../graph.js';
import { buildClinicianPrivilegeSnapshot } from '../clinicianSnapshot.js';
import { normalizePrivilegeCode } from '../types.js';

export interface ValidatePrivilegeInput {
  clinicianId: string;
  privilegeCode: string;
  orgId?: string;
}

export interface ValidatePrivilegeResult {
  eligible: boolean;
  missingPrereqs: string[];
  conflicts: string[];
  evaluatedAt: Date;
}

export interface ExpandPrivilegeSetInput {
  privilegeCode: string;
  maxDepth?: number;
  includeInactive?: boolean;
}

export interface ExpandPrivilegeSetResult {
  privilegeCode: string;
  dependencies: string[];
  conflicts: string[];
  depth: number;
  graph: {
    nodes: string[];
    edges: Array<{ from: string; to: string; type: string }>;
  };
}

export interface DetectConflictsInput {
  clinicianId: string;
  orgId?: string;
  privilegeCodes?: string[];
}

export class PrivilegeDAGModule implements DomainModule {
  readonly id = 'privilege-dag';
  readonly name = 'PrivilegeDAG';

  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle privilege change events
      if (event.type === 'PrivilegeGranted' || event.type === 'PrivilegeRevoked' || event.type === 'privilege.changed') {
        const payload = event.payload as { clinicianId: string; privilegeCode?: string };
        if (payload.clinicianId) {
          // Auto-detect conflicts when privileges change
          await this.detectConflicts({
            clinicianId: payload.clinicianId,
            privilegeCodes: payload.privilegeCode ? [payload.privilegeCode] : undefined,
          });
        }
        return;
      }

      // Handle credential update events that may affect privilege eligibility
      if (event.type === 'CredentialUpdated' || event.type === 'credential.updated') {
        const payload = event.payload as { clinicianId: string };
        if (payload.clinicianId) {
          // Re-validate all privileges when credentials change
          const snapshot = await buildClinicianPrivilegeSnapshot(payload.clinicianId);
          const privilegeCodes = Array.from(snapshot.grantedPrivilegeCodes);

          for (const code of privilegeCodes) {
            await this.validatePrivilege({
              clinicianId: payload.clinicianId,
              privilegeCode: code,
            });
          }
        }
        return;
      }
    } catch (error) {
      console.error('[PrivilegeDAGModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Validate privilege
      if (task.type === 'validatePrivilege' || task.type === 'privilege.validate') {
        const input = task.payload as ValidatePrivilegeInput;
        const result = await this.validatePrivilege(input);
        return {
          success: true,
          data: result,
        };
      }

      // Expand privilege set
      if (task.type === 'expandPrivilegeSet' || task.type === 'privilege.expand') {
        const input = task.payload as ExpandPrivilegeSetInput;
        const result = await this.expandPrivilegeSet(input);
        return {
          success: true,
          data: result,
        };
      }

      // Detect conflicts
      if (task.type === 'detectConflicts' || task.type === 'privilege.detectConflicts') {
        const input = task.payload as DetectConflictsInput;
        const result = await this.detectConflicts(input);
        return {
          success: true,
          data: result,
        };
      }

      return {
        success: false,
        error: `Unknown task type: ${task.type}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate privilege eligibility for a clinician
   */
  async validatePrivilege(input: ValidatePrivilegeInput): Promise<ValidatePrivilegeResult> {
    const eligibilityResult = await evaluatePrivilegeEligibility({
      clinicianId: input.clinicianId,
      privilegeCode: input.privilegeCode,
      orgId: input.orgId,
      broadcast: false,
    });

    return {
      eligible: eligibilityResult.eligible,
      missingPrereqs: eligibilityResult.missingPrereqs,
      conflicts: eligibilityResult.conflicts,
      evaluatedAt: eligibilityResult.evaluatedAt,
    };
  }

  /**
   * Expand privilege set to include all dependencies
   */
  async expandPrivilegeSet(input: ExpandPrivilegeSetInput): Promise<ExpandPrivilegeSetResult> {
    const normalizedCode = normalizePrivilegeCode(input.privilegeCode);
    const graph = await buildPrivilegeGraph(normalizedCode, {
      maxDepth: input.maxDepth ?? 5,
      includeInactive: input.includeInactive ?? false,
    });

    const dependencies = new Set<string>();
    const conflicts = new Set<string>();
    const edges: Array<{ from: string; to: string; type: string }> = [];

    // Traverse graph to collect dependencies
    for (const [code, node] of graph.nodes.entries()) {
      if (code !== normalizedCode) {
        dependencies.add(code);
      }

      // Collect edges
      const adjEdges = graph.adjacency[code] ?? [];
      for (const edge of adjEdges) {
        edges.push({
          from: code,
          to: edge.code,
          type: edge.dependencyType,
        });

        // Track conflicts
        if (edge.dependencyType === 'CONFLICTS_WITH' || edge.dependencyType === 'MUTUALLY_EXCLUSIVE') {
          conflicts.add(edge.code);
        }
      }
    }

    return {
      privilegeCode: normalizedCode,
      dependencies: Array.from(dependencies),
      conflicts: Array.from(conflicts),
      depth: graph.nodes.size,
      graph: {
        nodes: Array.from(graph.nodes.keys()),
        edges,
      },
    };
  }

  /**
   * Detect conflicts in a clinician's privilege set
   */
  async detectConflicts(input: DetectConflictsInput): Promise<PrivilegeConflictDetectionResult> {
    const result = await detectPrivilegeConflicts({
      clinicianId: input.clinicianId,
      orgId: input.orgId,
      broadcast: false,
    });

    return result;
  }

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Privilege dependency graph validation, expansion, and conflict detection',
      version: '1.0.0',
      supportedEvents: [
        'PrivilegeGranted',
        'PrivilegeRevoked',
        'privilege.changed',
        'CredentialUpdated',
        'credential.updated',
      ],
      supportedTasks: [
        'validatePrivilege',
        'privilege.validate',
        'expandPrivilegeSet',
        'privilege.expand',
        'detectConflicts',
        'privilege.detectConflicts',
      ],
    };
  }
}

export const privilegeDAGModule = new PrivilegeDAGModule();


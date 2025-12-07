/**
 * B211B-MK-006: SafetyRadar Microkernel Module
 *
 * Implements DomainModule interface for safety signal detection and restriction management.
 * Exposes handleEvent(), handleTask(), and getCapabilities().
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../../microkernel/types.js';
import { SafetySignalCollector } from '../collectors/signalCollector.js';
import { RestrictionEngine, loadPrivilegeGraph, fetchActiveSafetyStateMap } from '../restrictionEngine.js';
import { runAutoHoldTrigger } from '../triggers/autoHold.js';
import { runAutoFPPETrigger } from '../triggers/autoFPPE.js';
import { runAutoReviewTrigger } from '../triggers/autoReview.js';
import type { DriftEvent } from '../../drift/types.js';
import type { QualitySignal } from '../../qualityFusion/models/QualitySignal.js';

export class SafetyRadarModule implements DomainModule {
  readonly id = 'safety-radar';
  readonly name = 'SafetyRadar';

  private collector: SafetySignalCollector;
  private engine: RestrictionEngine;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
    this.collector = new SafetySignalCollector(this.prisma);
    this.engine = new RestrictionEngine();
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle drift events
      if (event.type === 'DriftEvent' || event.type === 'drift.detected') {
        const driftEvent = event.payload as unknown as DriftEvent;
        await this.collector.recordDriftEvent(driftEvent, {
          clinicianId: driftEvent.metadata?.clinicianId as string | undefined,
          source: event.source ?? 'drift',
        });
        return;
      }

      // Handle quality signals
      if (event.type === 'QualitySignal' || event.type === 'quality.signal') {
        const qualitySignal = event.payload as unknown as QualitySignal;
        await this.collector.recordQualitySignal(qualitySignal, {
          clinicianId: qualitySignal.clinicianId,
          source: event.source ?? 'quality',
        });
        return;
      }

      // Handle safety signal events
      if (event.type === 'SafetySignal' || event.type === 'safety.signal') {
        const signal = event.payload as {
          clinicianId: string;
          orgId?: string;
          privilegeCodes: string[];
          signalType: string;
          severity: string;
          summary: string;
          source?: string;
          details?: Record<string, unknown>;
        };

        // Route to appropriate trigger based on severity
        if (signal.severity === 'CRITICAL') {
          await runAutoHoldTrigger({
            clinicianId: signal.clinicianId,
            orgId: signal.orgId ?? '',
            privilegeCodes: signal.privilegeCodes,
            signalType: signal.signalType as any,
            summary: signal.summary,
            source: signal.source ?? event.source ?? 'safety',
            details: signal.details,
          });
        } else if (signal.severity === 'HIGH') {
          await runAutoFPPETrigger({
            clinicianId: signal.clinicianId,
            orgId: signal.orgId ?? '',
            privilegeGrantedId: '',
            privilegeCodes: signal.privilegeCodes,
            signalType: signal.signalType as any,
            summary: signal.summary,
            source: signal.source ?? event.source ?? 'safety',
            details: signal.details,
          });
        } else if (signal.severity === 'MEDIUM' || signal.severity === 'MED') {
          await runAutoReviewTrigger({
            clinicianId: signal.clinicianId,
            orgId: signal.orgId ?? '',
            privilegeCodes: signal.privilegeCodes,
            signalType: signal.signalType as any,
            summary: signal.summary,
            source: signal.source ?? event.source ?? 'safety',
            details: signal.details,
          });
        }
        return;
      }
    } catch (error) {
      console.error('[SafetyRadarModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Evaluate safety restrictions
      if (task.type === 'evaluateRestrictions' || task.type === 'safety.evaluate') {
        const { clinicianId, privilegeCodes } = task.payload as {
          clinicianId: string;
          privilegeCodes?: string[];
        };

        const graph = await loadPrivilegeGraph(this.prisma);
        const existingStates = await fetchActiveSafetyStateMap(
          this.prisma,
          clinicianId,
          privilegeCodes
        );

        // Get recent signals
        const signals = await this.prisma.privilegeSafetySignal.findMany({
          where: {
            clinicianId,
            resolvedAt: null,
            ...(privilegeCodes ? { privilegeCodes: { hasSome: privilegeCodes } } : {}),
          },
          orderBy: { detectedAt: 'desc' },
          take: 50,
        });

        const decisions = this.engine.evaluate({
          graph,
          signals: signals.map((s) => ({
            id: s.id,
            privilegeCodes: s.privilegeCodes,
            severity: s.severity,
            reasonCode: `SAFETY:${s.signalType}`,
            source: s.source,
            summary: s.summary,
            metadata: (s.details as Record<string, unknown>) ?? {},
          })),
          existingStates,
        });

        return {
          success: true,
          data: {
            decisions,
            existingStates,
            signalCount: signals.length,
          },
        };
      }

      // Collect safety signal
      if (task.type === 'collectSignal' || task.type === 'safety.collect') {
        const input = task.payload as {
          type: 'drift' | 'quality' | 'fusion';
          data: unknown;
        };

        let result;
        if (input.type === 'drift') {
          result = await this.collector.recordDriftEvent(
            input.data as DriftEvent,
            task.metadata as any
          );
        } else if (input.type === 'quality') {
          result = await this.collector.recordQualitySignal(
            input.data as QualitySignal,
            task.metadata as any
          );
        } else {
          return {
            success: false,
            error: `Unsupported signal type: ${input.type}`,
          };
        }

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

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Safety signal detection, restriction evaluation, and automatic trigger management',
      version: '1.0.0',
      supportedEvents: [
        'DriftEvent',
        'drift.detected',
        'QualitySignal',
        'quality.signal',
        'SafetySignal',
        'safety.signal',
      ],
      supportedTasks: [
        'evaluateRestrictions',
        'safety.evaluate',
        'collectSignal',
        'safety.collect',
      ],
    };
  }
}

export const safetyRadarModule = new SafetyRadarModule();


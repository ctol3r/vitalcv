/**
 * B211B-MK-010: Workforce Forecast Engine Microkernel Module
 *
 * Implements DomainModule interface for workforce forecasting.
 * Module provides forecast(), supplyShockDetect(), demandSpikeDetect().
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../../microkernel/types.js';
import { DemandForecastEngine, type ForecastRequest, type ForecastResponse } from '../demandEngine.js';
import { SupplyForecastEngine, type SupplyForecastRequest, type AggregateSupplyForecast } from '../supplyEngine.js';
import { SupplyShockDetector, type SupplyShock } from '../detectors/supplyShockDetector.js';
import { CriticalDemandForecastDetector, type CriticalShortageAlert } from '../detectors/criticalDemandDetector.js';
import { SimpleWorkforceSupplyGraph } from '../graph/workforceSupplyGraph.js';

export interface ForecastInput {
  orgId?: string;
  department?: string;
  specialty?: string;
  role?: string;
  startDate?: Date;
  horizonDays?: number[];
  modelType?: 'ml' | 'statistical' | 'hybrid';
}

export interface SupplyShockDetectInput {
  orgId?: string;
  departmentId?: string;
  systemId?: string;
  timeWindowDays?: number;
}

export interface DemandSpikeDetectInput {
  orgId?: string;
  department?: string;
  specialty?: string;
  role?: string;
  horizonDays?: number;
  threshold?: number;
}

export class WorkforceForecastModule implements DomainModule {
  readonly id = 'workforce-forecast';
  readonly name = 'WorkforceForecast';

  private demandEngine: DemandForecastEngine;
  private supplyEngine: SupplyForecastEngine;
  private supplyShockDetector: SupplyShockDetector;
  private demandSpikeDetector: CriticalDemandForecastDetector;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
    this.demandEngine = new DemandForecastEngine(this.prisma);
    this.supplyEngine = new SupplyForecastEngine(this.prisma);
    this.supplyShockDetector = new SupplyShockDetector();
    const supplyGraph = new SimpleWorkforceSupplyGraph(this.prisma);
    this.demandSpikeDetector = new CriticalDemandForecastDetector(
      this.prisma,
      this.demandEngine,
      supplyGraph
    );
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle workforce change events
      if (event.type === 'ClinicianAdded' || event.type === 'ClinicianRemoved' || event.type === 'workforce.changed') {
        const payload = event.payload as { orgId?: string; departmentId?: string };
        // Trigger forecast recalculation when workforce changes
        if (payload.orgId || payload.departmentId) {
          await this.forecast({
            orgId: payload.orgId,
            department: payload.departmentId,
          });
        }
        return;
      }

      // Handle credential expiration events
      if (event.type === 'CredentialExpiring' || event.type === 'credential.expiring') {
        const payload = event.payload as { orgId?: string; departmentId?: string };
        // Check for supply shocks when credentials are expiring
        if (payload.orgId || payload.departmentId) {
          await this.supplyShockDetect({
            orgId: payload.orgId,
            departmentId: payload.departmentId,
          });
        }
        return;
      }

      // Handle privilege hold events
      if (event.type === 'PrivilegeHold' || event.type === 'privilege.hold') {
        const payload = event.payload as { orgId?: string; departmentId?: string };
        // Check for supply shocks when privileges are held
        if (payload.orgId || payload.departmentId) {
          await this.supplyShockDetect({
            orgId: payload.orgId,
            departmentId: payload.departmentId,
          });
        }
        return;
      }
    } catch (error) {
      console.error('[WorkforceForecastModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Forecast
      if (task.type === 'forecast' || task.type === 'workforce.forecast') {
        const input = task.payload as ForecastInput;
        const result = await this.forecast(input);
        return {
          success: true,
          data: result,
        };
      }

      // Supply shock detection
      if (task.type === 'supplyShockDetect' || task.type === 'workforce.supplyShock') {
        const input = task.payload as SupplyShockDetectInput;
        const result = await this.supplyShockDetect(input);
        return {
          success: true,
          data: result,
        };
      }

      // Demand spike detection
      if (task.type === 'demandSpikeDetect' || task.type === 'workforce.demandSpike') {
        const input = task.payload as DemandSpikeDetectInput;
        const result = await this.demandSpikeDetect(input);
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
   * Generate workforce forecast
   */
  async forecast(input: ForecastInput): Promise<{
    demand: ForecastResponse;
    supply: AggregateSupplyForecast;
  }> {
    // Generate demand forecast
    const demandRequest: ForecastRequest = {
      orgId: input.orgId,
      department: input.department,
      specialty: input.specialty,
      role: input.role,
      startDate: input.startDate,
      horizonDays: input.horizonDays ?? [7, 14, 30, 90],
      modelType: input.modelType,
    };
    const demandForecast = await this.demandEngine.forecast(demandRequest);

    // Generate supply forecast
    const supplyRequest: SupplyForecastRequest = {
      orgId: input.orgId,
      departmentId: input.department,
      timeWindowDays: input.horizonDays?.[0] ?? 30,
    };
    const supplyForecast = await this.supplyEngine.generateForecast(supplyRequest);

    return {
      demand: demandForecast,
      supply: supplyForecast,
    };
  }

  /**
   * Detect supply shocks
   */
  async supplyShockDetect(input: SupplyShockDetectInput): Promise<SupplyShock[]> {
    // Generate supply forecast
    const supplyRequest: SupplyForecastRequest = {
      orgId: input.orgId,
      departmentId: input.departmentId,
      systemId: input.systemId,
      timeWindowDays: input.timeWindowDays ?? 30,
    };
    const forecast = await this.supplyEngine.generateForecast(supplyRequest);

    // Detect shocks
    const shocks = await this.supplyShockDetector.detectShocks(forecast);

    return shocks;
  }

  /**
   * Detect demand spikes
   */
  async demandSpikeDetect(input: DemandSpikeDetectInput): Promise<CriticalShortageAlert[]> {
    // Generate demand forecast request
    const forecastRequest: ForecastRequest = {
      orgId: input.orgId,
      department: input.department,
      specialty: input.specialty,
      role: input.role,
      horizonDays: input.horizonDays ? [input.horizonDays] : [7, 14, 30, 90],
    };

    // Detect critical shortages (demand spikes)
    const detectionResult = await this.demandSpikeDetector.detectCriticalShortages(
      forecastRequest,
      {
        threshold: input.threshold ?? 1.2, // Default 20% over capacity
        orgId: input.orgId,
        horizons: forecastRequest.horizonDays,
      }
    );

    return detectionResult.alerts;
  }

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Workforce demand and supply forecasting with shock and spike detection',
      version: '1.0.0',
      supportedEvents: [
        'ClinicianAdded',
        'ClinicianRemoved',
        'workforce.changed',
        'CredentialExpiring',
        'credential.expiring',
        'PrivilegeHold',
        'privilege.hold',
      ],
      supportedTasks: [
        'forecast',
        'workforce.forecast',
        'supplyShockDetect',
        'workforce.supplyShock',
        'demandSpikeDetect',
        'workforce.demandSpike',
      ],
    };
  }
}

export const workforceForecastModule = new WorkforceForecastModule();


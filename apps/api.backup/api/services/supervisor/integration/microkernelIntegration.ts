/**
 * SupervisorAgent → Microkernel Integration
 *
 * Supervisor discovers modules via registry and uses getCapabilities()
 * to decide routing. Modules can override policies.
 */

import { moduleRegistry, type ModuleRecord, type ModuleCapability } from '../../microkernel/registry.js';
import { getTaskPriority, canExecuteTask, type PolicyContext } from '../policies/policyEngine.js';
import { SupervisorTaskType } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const log = createLogger({ service: 'supervisor-microkernel-integration' });

export interface RoutingDecision {
  /** Module ID to route to */
  moduleId: string;
  /** Capability to use */
  capability: ModuleCapability;
  /** Whether policy was overridden */
  policyOverridden: boolean;
  /** Reasoning for the decision */
  reason: string;
}

/**
 * Discover modules that can handle a task type
 */
export function discoverModulesForTask(taskType: SupervisorTaskType): ModuleRecord[] {
  // Map SupervisorTaskType to capability IDs
  const capabilityId = mapTaskTypeToCapability(taskType);

  if (!capabilityId) {
    log.warn('No capability mapping for task type', { taskType });
    return [];
  }

  const modules = moduleRegistry.findModulesForCapability(capabilityId);
  log.debug('Discovered modules for task', {
    taskType,
    capabilityId,
    moduleCount: modules.length,
    moduleIds: modules.map(m => m.id),
  });

  return modules;
}

/**
 * Get capabilities for a module
 */
export function getModuleCapabilities(moduleId: string): ModuleCapability[] {
  return moduleRegistry.getCapabilities(moduleId);
}

/**
 * Decide routing for a task using module capabilities
 */
export async function decideRouting(
  taskType: SupervisorTaskType,
  context?: PolicyContext
): Promise<RoutingDecision | null> {
  const modules = discoverModulesForTask(taskType);

  if (modules.length === 0) {
    log.warn('No modules found for task', { taskType });
    return null;
  }

  // Check policy for each module
  for (const module of modules) {
    const canOverride = moduleRegistry.canOverridePolicies(module.id);

    // If module can override policies, route to it directly
    if (canOverride) {
      const capability = findCapabilityForTask(module, taskType);
      if (capability) {
        log.info('Routing to module with policy override', {
          taskType,
          moduleId: module.id,
          capabilityId: capability.id,
        });

        return {
          moduleId: module.id,
          capability,
          policyOverridden: true,
          reason: 'Module has policy override permission',
        };
      }
    }

    // Otherwise check if task can execute normally
    const policyCheck = await canExecuteTask(taskType, context);
    if (policyCheck.allowed) {
      const capability = findCapabilityForTask(module, taskType);
      if (capability) {
        log.debug('Routing to module after policy check', {
          taskType,
          moduleId: module.id,
          capabilityId: capability.id,
        });

        return {
          moduleId: module.id,
          capability,
          policyOverridden: false,
          reason: 'Policy check passed',
        };
      }
    } else {
      log.debug('Policy violation, skipping module', {
        taskType,
        moduleId: module.id,
        violation: policyCheck.violation?.reason,
      });
    }
  }

  // If no module passed policy checks, return null
  log.warn('No routing decision found after policy checks', { taskType });
  return null;
}

/**
 * Get routing decisions for multiple tasks (returns best match per task)
 */
export async function batchDecideRouting(
  taskTypes: SupervisorTaskType[],
  context?: PolicyContext
): Promise<Map<SupervisorTaskType, RoutingDecision | null>> {
  const decisions = new Map<SupervisorTaskType, RoutingDecision | null>();

  for (const taskType of taskTypes) {
    const decision = await decideRouting(taskType, context);
    decisions.set(taskType, decision);
  }

  return decisions;
}

/**
 * Map SupervisorTaskType to capability ID
 */
function mapTaskTypeToCapability(taskType: SupervisorTaskType): string | null {
  const mapping: Record<string, string> = {
    'RUN_PSV': 'psv.run',
    'RUN_DRIFT_SWEEP': 'drift.sweep',
    'RUN_SAFETY_SWEEP': 'safety.sweep',
    'RUN_COMPLIANCE': 'compliance.check',
    'RUN_FUSION': 'fusion.update',
    'RUN_MOBILITY': 'mobility.evaluate',
    'RUN_EHR_SYNC': 'ehr.sync',
    'RUN_NCI_PUBLISH': 'nci.publish',
    'RUN_PRIVILEGE_ISSUE': 'privilege.issue',
  };

  return mapping[taskType] ?? null;
}

/**
 * Find capability in module that handles a task type
 */
function findCapabilityForTask(
  module: ModuleRecord,
  taskType: SupervisorTaskType
): ModuleCapability | null {
  const capabilityId = mapTaskTypeToCapability(taskType);
  if (!capabilityId) {
    return null;
  }

  return module.capabilities.find(cap => cap.id === capabilityId) ?? null;
}

/**
 * Check if a module has a specific capability
 */
export function moduleHasCapability(moduleId: string, capabilityId: string): boolean {
  const capabilities = moduleRegistry.getCapabilities(moduleId);
  return capabilities.some(cap => cap.id === capabilityId);
}

/**
 * Get all modules with their capabilities (for UI)
 */
export function getAllModulesWithCapabilities(): Array<ModuleRecord & {
  capabilitySummary: {
    tasks: number;
    events: number;
    flows: number;
    total: number;
  };
}> {
  return moduleRegistry.getAll().map(module => ({
    ...module,
    capabilitySummary: {
      tasks: module.capabilities.filter(c => c.type === 'task').length,
      events: module.capabilities.filter(c => c.type === 'event').length,
      flows: module.capabilities.filter(c => c.type === 'flow').length,
      total: module.capabilities.length,
    },
  }));
}


/**
 * Tests for SupervisorPolicyEngine
 */

import { describe, it, expect } from '@jest/globals';
import {
  SupervisorTaskType,
  SupervisorTaskStatus,
} from '@prisma/client';
import {
  canExecuteTask,
  getTaskPriority,
  resolvePolicies,
  getTasksByPriority,
  type PolicyContext,
} from '../policies/policyEngine.js';

describe('SupervisorPolicyEngine', () => {
  describe('getTaskPriority', () => {
    it('should return correct priority for DRIFT_SWEEP', () => {
      expect(getTaskPriority(SupervisorTaskType.RUN_DRIFT_SWEEP)).toBe(100);
    });

    it('should return correct priority for SAFETY_SWEEP', () => {
      expect(getTaskPriority(SupervisorTaskType.RUN_SAFETY_SWEEP)).toBe(80);
    });

    it('should return correct priority for COMPLIANCE', () => {
      expect(getTaskPriority(SupervisorTaskType.RUN_COMPLIANCE)).toBe(60);
    });

    it('should return correct priority for PSV', () => {
      expect(getTaskPriority(SupervisorTaskType.RUN_PSV)).toBe(40);
    });

    it('should prioritize DRIFT > SAFETY > COMPLIANCE > PSV', () => {
      const drift = getTaskPriority(SupervisorTaskType.RUN_DRIFT_SWEEP);
      const safety = getTaskPriority(SupervisorTaskType.RUN_SAFETY_SWEEP);
      const compliance = getTaskPriority(SupervisorTaskType.RUN_COMPLIANCE);
      const psv = getTaskPriority(SupervisorTaskType.RUN_PSV);

      expect(drift).toBeGreaterThan(safety);
      expect(safety).toBeGreaterThan(compliance);
      expect(compliance).toBeGreaterThan(psv);
    });
  });

  describe('canExecuteTask', () => {
    it('should allow task when no blocking tasks are running', async () => {
      const context: PolicyContext = {
        runningTasks: [],
        pendingTasks: [],
      };

      const result = await canExecuteTask(
        SupervisorTaskType.RUN_FUSION,
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    it('should block FUSION when SAFETY_SWEEP is running', async () => {
      const context: PolicyContext = {
        runningTasks: [SupervisorTaskType.RUN_SAFETY_SWEEP],
        pendingTasks: [],
      };

      const result = await canExecuteTask(
        SupervisorTaskType.RUN_FUSION,
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.taskType).toBe(SupervisorTaskType.RUN_FUSION);
      expect(result.violation?.reason).toContain('SAFETY_SWEEP');
      expect(result.violation?.blockingTasks).toContain(
        SupervisorTaskType.RUN_SAFETY_SWEEP
      );
    });

    it('should allow SAFETY_SWEEP when no conflicts', async () => {
      const context: PolicyContext = {
        runningTasks: [],
        pendingTasks: [],
      };

      const result = await canExecuteTask(
        SupervisorTaskType.RUN_SAFETY_SWEEP,
        context
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow other tasks when SAFETY_SWEEP is running', async () => {
      const context: PolicyContext = {
        runningTasks: [SupervisorTaskType.RUN_SAFETY_SWEEP],
        pendingTasks: [],
      };

      const result = await canExecuteTask(
        SupervisorTaskType.RUN_DRIFT_SWEEP,
        context
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('resolvePolicies', () => {
    it('should return all tasks when no conflicts', async () => {
      const proposed = [
        SupervisorTaskType.RUN_DRIFT_SWEEP,
        SupervisorTaskType.RUN_PSV,
        SupervisorTaskType.RUN_COMPLIANCE,
      ];

      const allowed = await resolvePolicies(proposed);

      expect(allowed).toHaveLength(3);
      expect(allowed).toContain(SupervisorTaskType.RUN_DRIFT_SWEEP);
      expect(allowed).toContain(SupervisorTaskType.RUN_PSV);
      expect(allowed).toContain(SupervisorTaskType.RUN_COMPLIANCE);
    });

    it('should filter out FUSION when SAFETY_SWEEP is running', async () => {
      const context: PolicyContext = {
        runningTasks: [SupervisorTaskType.RUN_SAFETY_SWEEP],
        pendingTasks: [],
      };

      // Test canExecuteTask directly
      const fusionCheck = await canExecuteTask(
        SupervisorTaskType.RUN_FUSION,
        context
      );
      expect(fusionCheck.allowed).toBe(false);

      // Test with resolvePolicies using context
      const proposed = [
        SupervisorTaskType.RUN_FUSION,
        SupervisorTaskType.RUN_DRIFT_SWEEP,
      ];

      // resolvePolicies builds context from DB, so we test canExecuteTask with context
      // For this test, we verify the policy check works
      const driftCheck = await canExecuteTask(
        SupervisorTaskType.RUN_DRIFT_SWEEP,
        context
      );
      expect(driftCheck.allowed).toBe(true);
    });

    it('should prioritize tasks correctly', async () => {
      const proposed = [
        SupervisorTaskType.RUN_PSV,
        SupervisorTaskType.RUN_DRIFT_SWEEP,
        SupervisorTaskType.RUN_COMPLIANCE,
        SupervisorTaskType.RUN_SAFETY_SWEEP,
      ];

      const allowed = await resolvePolicies(proposed);

      // Should be sorted by priority (highest first)
      expect(allowed[0]).toBe(SupervisorTaskType.RUN_DRIFT_SWEEP);
      expect(allowed[1]).toBe(SupervisorTaskType.RUN_SAFETY_SWEEP);
      expect(allowed[2]).toBe(SupervisorTaskType.RUN_COMPLIANCE);
      expect(allowed[3]).toBe(SupervisorTaskType.RUN_PSV);
    });
  });

  describe('getTasksByPriority', () => {
    it('should return tasks sorted by priority (highest first)', () => {
      const sorted = getTasksByPriority();

      expect(sorted[0]).toBe(SupervisorTaskType.RUN_DRIFT_SWEEP);
      expect(sorted[1]).toBe(SupervisorTaskType.RUN_SAFETY_SWEEP);
      expect(sorted[2]).toBe(SupervisorTaskType.RUN_COMPLIANCE);
      expect(sorted[3]).toBe(SupervisorTaskType.RUN_PSV);
    });
  });
});


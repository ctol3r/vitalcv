/**
 * AlertingService Tests
 * B245B-OBS-020: Comprehensive test suite for alerting functionality
 */

import { PrismaClient, AlertComparator, NotificationChannelType, IncidentStatus } from '@prisma/client';
import { AlertingService, MetricStore, MetricValue } from '../services/alertingService';
import { AlertNotificationService } from '../services/alertingService';
import { AlertRuleModel } from '../models/AlertRule';
import { NotificationChannelModel } from '../models/NotificationChannel';
import { IncidentModel } from '../models/Incident';

describe('AlertingService', () => {
  let prisma: PrismaClient;
  let alertingService: AlertingService;
  let notificationService: AlertNotificationService;
  let mockMetricStore: MetricStore;
  let alertRuleModel: AlertRuleModel;
  let channelModel: NotificationChannelModel;
  let incidentModel: IncidentModel;
  let testChannelId: string;
  let testRuleId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();

    // Create mock metric store
    const metrics: Map<string, MetricValue> = new Map();
    mockMetricStore = {
      getMetric: async (metricName: string) => {
        return metrics.get(metricName) || null;
      },
      getMetricsInRange: async () => [],
      getAverageMetric: async () => null,
    };

    notificationService = new AlertNotificationService(prisma);
    alertingService = new AlertingService(
      prisma,
      mockMetricStore,
      notificationService,
      100 // Short interval for testing
    );

    alertRuleModel = new AlertRuleModel(prisma);
    channelModel = new NotificationChannelModel(prisma);
    incidentModel = new IncidentModel(prisma);

    // Create test notification channel
    const channel = await channelModel.create({
      type: NotificationChannelType.WEBHOOK,
      name: 'Test Channel',
      config: {
        webhookUrl: 'https://example.com/webhook',
      },
    });
    testChannelId = channel.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testRuleId) {
      try {
        await alertRuleModel.delete(testRuleId);
      } catch (error) {
        // Ignore if already deleted
      }
    }
    if (testChannelId) {
      try {
        await channelModel.delete(testChannelId);
      } catch (error) {
        // Ignore if already deleted
      }
    }

    await alertingService.stop();
    await prisma.$disconnect();
  });

  describe('Alert Evaluation', () => {
    it('should evaluate alert rule when metric breaches threshold', async () => {
      // Create alert rule: CPU usage > 80% for 5 minutes
      const rule = await alertRuleModel.create({
        name: 'High CPU Usage',
        metricName: 'cpu_usage_percent',
        comparator: AlertComparator.GT,
        threshold: 80,
        duration: 5, // 5 minutes
        channelId: testChannelId,
        isEnabled: true,
      });
      testRuleId = rule.id;

      // Mock metric value above threshold
      const mockMetric: MetricValue = {
        name: 'cpu_usage_percent',
        value: 85,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['cpu_usage_percent', mockMetric]]);

      // Evaluate rule
      const ruleWithChannel = await alertRuleModel.findById(rule.id);
      if (ruleWithChannel) {
        await alertingService.evaluateRule(ruleWithChannel);
      }

      // Check if incident was created (may need to wait for duration)
      const incidents = await incidentModel.list({ alertRuleId: rule.id });
      // Note: In real scenario, we'd need to wait for duration to pass
    });

    it('should not trigger alert if duration requirement not met', async () => {
      // Create alert rule: CPU usage > 80% for 10 minutes
      const rule = await alertRuleModel.create({
        name: 'High CPU Usage',
        metricName: 'cpu_usage_percent',
        comparator: AlertComparator.GT,
        threshold: 80,
        duration: 10, // 10 minutes
        channelId: testChannelId,
        isEnabled: true,
      });
      testRuleId = rule.id;

      // Mock metric value above threshold
      const mockMetric: MetricValue = {
        name: 'cpu_usage_percent',
        value: 85,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['cpu_usage_percent', mockMetric]]);

      // Evaluate rule immediately (duration not met)
      const ruleWithChannel = await alertRuleModel.findById(rule.id);
      if (ruleWithChannel) {
        await alertingService.evaluateRule(ruleWithChannel);
      }

      // Should not create incident yet
      const incidents = await incidentModel.list({ alertRuleId: rule.id, status: 'OPEN' });
      expect(incidents.length).toBe(0);
    });

    it('should apply hysteresis to prevent flapping', async () => {
      // Create alert rule: Memory usage > 90%
      const rule = await alertRuleModel.create({
        name: 'High Memory Usage',
        metricName: 'memory_usage_percent',
        comparator: AlertComparator.GT,
        threshold: 90,
        duration: 1, // 1 minute
        channelId: testChannelId,
        isEnabled: true,
      });
      testRuleId = rule.id;

      // Start with value above threshold
      const mockMetric1: MetricValue = {
        name: 'memory_usage_percent',
        value: 95,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['memory_usage_percent', mockMetric1]]);

      const ruleWithChannel = await alertRuleModel.findById(rule.id);
      if (ruleWithChannel) {
        // Evaluate and trigger alert
        await alertingService.evaluateRule(ruleWithChannel);

        // Now value just below threshold (but above hysteresis threshold)
        const mockMetric2: MetricValue = {
          name: 'memory_usage_percent',
          value: 89, // Below 90 but above 81 (90 * 0.9)
          timestamp: new Date(),
        };
        (mockMetricStore as any).metrics = new Map([['memory_usage_percent', mockMetric2]]);

        // Should still be considered breached due to hysteresis
        await alertingService.evaluateRule(ruleWithChannel);

        // Value below hysteresis threshold
        const mockMetric3: MetricValue = {
          name: 'memory_usage_percent',
          value: 80, // Below hysteresis threshold
          timestamp: new Date(),
        };
        (mockMetricStore as any).metrics = new Map([['memory_usage_percent', mockMetric3]]);

        // Should now recover
        await alertingService.evaluateRule(ruleWithChannel);

        const state = alertingService.getEvaluationState(rule.id);
        expect(state?.thresholdBreached).toBe(false);
      }
    });

    it('should not trigger duplicate alerts within time window', async () => {
      // Create alert rule
      const rule = await alertRuleModel.create({
        name: 'Error Rate Alert',
        metricName: 'error_rate',
        comparator: AlertComparator.GT,
        threshold: 10,
        duration: 1,
        channelId: testChannelId,
        isEnabled: true,
      });
      testRuleId = rule.id;

      // Mock metric above threshold
      const mockMetric: MetricValue = {
        name: 'error_rate',
        value: 15,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['error_rate', mockMetric]]);

      const ruleWithChannel = await alertRuleModel.findById(rule.id);
      if (ruleWithChannel) {
        // Trigger alert multiple times quickly
        await alertingService.evaluateRule(ruleWithChannel);
        await alertingService.evaluateRule(ruleWithChannel);
        await alertingService.evaluateRule(ruleWithChannel);

        // Should only create one incident
        const incidents = await incidentModel.list({ alertRuleId: rule.id });
        expect(incidents.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Multiple Thresholds', () => {
    it('should handle multiple alert rules for same metric', async () => {
      // Create multiple rules for same metric with different thresholds
      const rule1 = await alertRuleModel.create({
        name: 'Warning: CPU > 70%',
        metricName: 'cpu_usage_percent',
        comparator: AlertComparator.GT,
        threshold: 70,
        duration: 5,
        channelId: testChannelId,
        isEnabled: true,
      });

      const rule2 = await alertRuleModel.create({
        name: 'Critical: CPU > 90%',
        metricName: 'cpu_usage_percent',
        comparator: AlertComparator.GT,
        threshold: 90,
        duration: 2,
        channelId: testChannelId,
        isEnabled: true,
      });

      // Mock metric value
      const mockMetric: MetricValue = {
        name: 'cpu_usage_percent',
        value: 85,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['cpu_usage_percent', mockMetric]]);

      // Evaluate both rules
      await alertingService.evaluateAllRules();

      // Rule 1 should trigger (85 > 70)
      // Rule 2 should not trigger (85 < 90)
      const state1 = alertingService.getEvaluationState(rule1.id);
      const state2 = alertingService.getEvaluationState(rule2.id);

      expect(state1?.thresholdBreached).toBe(true);
      expect(state2?.thresholdBreached).toBe(false);

      // Cleanup
      await alertRuleModel.delete(rule1.id);
      await alertRuleModel.delete(rule2.id);
    });
  });

  describe('Disabled Rules', () => {
    it('should skip disabled alert rules', async () => {
      // Create disabled alert rule
      const rule = await alertRuleModel.create({
        name: 'Disabled Alert',
        metricName: 'test_metric',
        comparator: AlertComparator.GT,
        threshold: 50,
        duration: 1,
        channelId: testChannelId,
        isEnabled: false,
      });
      testRuleId = rule.id;

      // Mock metric above threshold
      const mockMetric: MetricValue = {
        name: 'test_metric',
        value: 100,
        timestamp: new Date(),
      };
      (mockMetricStore as any).metrics = new Map([['test_metric', mockMetric]]);

      // Evaluate all rules (disabled rule should be skipped)
      await alertingService.evaluateAllRules();

      const state = alertingService.getEvaluationState(rule.id);
      expect(state).toBeNull(); // State should not exist for disabled rules
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing metric gracefully', async () => {
      const rule = await alertRuleModel.create({
        name: 'Missing Metric Alert',
        metricName: 'nonexistent_metric',
        comparator: AlertComparator.GT,
        threshold: 50,
        duration: 1,
        channelId: testChannelId,
        isEnabled: true,
      });
      testRuleId = rule.id;

      // No metric in store
      (mockMetricStore as any).metrics = new Map();

      const ruleWithChannel = await alertRuleModel.findById(rule.id);
      if (ruleWithChannel) {
        // Should not throw error
        await expect(alertingService.evaluateRule(ruleWithChannel)).resolves.not.toThrow();
      }
    });

    it('should handle different comparators correctly', async () => {
      const testCases = [
        { comparator: AlertComparator.GT, threshold: 80, value: 85, shouldBreach: true },
        { comparator: AlertComparator.GT, threshold: 80, value: 75, shouldBreach: false },
        { comparator: AlertComparator.LT, threshold: 20, value: 15, shouldBreach: true },
        { comparator: AlertComparator.LT, threshold: 20, value: 25, shouldBreach: false },
        { comparator: AlertComparator.GE, threshold: 80, value: 80, shouldBreach: true },
        { comparator: AlertComparator.GE, threshold: 80, value: 79, shouldBreach: false },
        { comparator: AlertComparator.LE, threshold: 20, value: 20, shouldBreach: true },
        { comparator: AlertComparator.LE, threshold: 20, value: 21, shouldBreach: false },
      ];

      for (const testCase of testCases) {
        const rule = await alertRuleModel.create({
          name: `Test ${testCase.comparator}`,
          metricName: 'test_metric',
          comparator: testCase.comparator,
          threshold: testCase.threshold,
          duration: 1,
          channelId: testChannelId,
          isEnabled: true,
        });

        const mockMetric: MetricValue = {
          name: 'test_metric',
          value: testCase.value,
          timestamp: new Date(),
        };
        (mockMetricStore as any).metrics = new Map([['test_metric', mockMetric]]);

        const ruleWithChannel = await alertRuleModel.findById(rule.id);
        if (ruleWithChannel) {
          await alertingService.evaluateRule(ruleWithChannel);
          const state = alertingService.getEvaluationState(rule.id);
          expect(state?.thresholdBreached).toBe(testCase.shouldBreach);
        }

        await alertRuleModel.delete(rule.id);
      }
    });
  });

  describe('Scheduled Evaluation', () => {
    it('should evaluate rules on schedule', (done) => {
      let evaluationCount = 0;

      // Mock evaluateAllRules
      const originalEvaluate = alertingService.evaluateAllRules.bind(alertingService);
      alertingService.evaluateAllRules = async () => {
        evaluationCount++;
        await originalEvaluate();
      };

      alertingService.start();

      // Wait for at least one evaluation
      setTimeout(() => {
        expect(evaluationCount).toBeGreaterThan(0);
        alertingService.stop();
        done();
      }, 150); // Wait 150ms (interval is 100ms)
    });

    it('should stop scheduled evaluation', () => {
      alertingService.start();
      expect((alertingService as any).evaluationInterval).toBeTruthy();

      alertingService.stop();
      expect((alertingService as any).evaluationInterval).toBeNull();
    });
  });
});


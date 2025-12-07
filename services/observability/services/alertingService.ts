/**
 * AlertingService
 * B245B-OBS-012: Evaluates metrics against alert rules on a schedule
 * Triggers alerts when thresholds are breached for specified duration
 * Supports hysteresis to avoid flapping
 */

import { PrismaClient, AlertRule, AlertComparator, IncidentStatus } from '@prisma/client';
import { AlertRuleModel } from '../models/AlertRule';
import { IncidentModel } from '../models/Incident';
import { AlertNotificationService } from './alertNotificationService';

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricStore {
  /**
   * Get the latest metric value by name
   */
  getMetric(metricName: string, labels?: Record<string, string>): Promise<MetricValue | null>;

  /**
   * Get metric values within a time range
   */
  getMetricsInRange(
    metricName: string,
    startTime: Date,
    endTime: Date,
    labels?: Record<string, string>
  ): Promise<MetricValue[]>;

  /**
   * Get average metric value over a time period
   */
  getAverageMetric(
    metricName: string,
    startTime: Date,
    endTime: Date,
    labels?: Record<string, string>
  ): Promise<number | null>;
}

interface AlertEvaluationState {
  ruleId: string;
  lastEvaluationTime: Date;
  thresholdBreached: boolean;
  breachStartTime: Date | null;
  lastTriggeredTime: Date | null;
  currentValue: number | null;
}

/**
 * Service for evaluating metrics against alert rules
 */
export class AlertingService {
  private evaluationInterval: NodeJS.Timeout | null = null;
  private evaluationStates: Map<string, AlertEvaluationState> = new Map();
  private readonly HYSTERESIS_FACTOR = 0.9; // 10% hysteresis to prevent flapping

  constructor(
    private prisma: PrismaClient,
    private metricStore: MetricStore,
    private notificationService: AlertNotificationService,
    private evaluationIntervalMs: number = 60000 // Default: evaluate every minute
  ) {}

  /**
   * Start the alerting evaluation loop
   */
  start(): void {
    if (this.evaluationInterval) {
      return; // Already started
    }

    // Evaluate immediately on start
    this.evaluateAllRules().catch((error) => {
      console.error('[AlertingService] Error in initial evaluation:', error);
    });

    // Then evaluate on schedule
    this.evaluationInterval = setInterval(() => {
      this.evaluateAllRules().catch((error) => {
        console.error('[AlertingService] Error in scheduled evaluation:', error);
      });
    }, this.evaluationIntervalMs);

    console.log(`[AlertingService] Started with evaluation interval: ${this.evaluationIntervalMs}ms`);
  }

  /**
   * Stop the alerting evaluation loop
   */
  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[AlertingService] Stopped');
    }
  }

  /**
   * Evaluate all enabled alert rules
   */
  async evaluateAllRules(): Promise<void> {
    const alertRuleModel = new AlertRuleModel(this.prisma);
    const rules = await alertRuleModel.list({ isEnabled: true });

    const evaluationPromises = rules.map((rule) => this.evaluateRule(rule));
    await Promise.allSettled(evaluationPromises);
  }

  /**
   * Evaluate a single alert rule
   */
  async evaluateRule(rule: AlertRule & { channel: { isEnabled: boolean } }): Promise<void> {
    try {
      // Skip if channel is disabled
      if (!rule.channel.isEnabled) {
        return;
      }

      // Get the latest metric value
      const metricValue = await this.metricStore.getMetric(rule.metricName);
      if (!metricValue) {
        // No metric data available, skip evaluation
        return;
      }

      const state = this.getOrCreateState(rule.id);
      state.lastEvaluationTime = new Date();
      state.currentValue = metricValue.value;

      // Determine if threshold is breached (with hysteresis)
      const isBreached = this.evaluateThreshold(
        metricValue.value,
        rule.threshold,
        rule.comparator,
        state.thresholdBreached // Pass current state for hysteresis
      );

      if (isBreached) {
        // Threshold is breached
        if (!state.thresholdBreached) {
          // Just started breaching
          state.thresholdBreached = true;
          state.breachStartTime = new Date();
        } else {
          // Already breaching - check if duration requirement is met
          const breachDuration = state.breachStartTime
            ? Date.now() - state.breachStartTime.getTime()
            : 0;
          const requiredDurationMs = rule.duration * 60 * 1000; // Convert minutes to ms

          if (breachDuration >= requiredDurationMs) {
            // Duration requirement met - trigger alert
            await this.triggerAlert(rule, metricValue.value, state);
          }
        }
      } else {
        // Threshold is not breached - reset state
        if (state.thresholdBreached) {
          // Just recovered from breach
          console.log(
            `[AlertingService] Rule ${rule.id} (${rule.name}) recovered - value: ${metricValue.value}`
          );
        }
        state.thresholdBreached = false;
        state.breachStartTime = null;
      }

      this.evaluationStates.set(rule.id, state);
    } catch (error) {
      console.error(`[AlertingService] Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * Evaluate threshold with hysteresis to prevent flapping
   */
  private evaluateThreshold(
    value: number,
    threshold: number,
    comparator: AlertComparator,
    currentlyBreached: boolean
  ): boolean {
    let effectiveThreshold = threshold;

    // Apply hysteresis: if currently breached, use a slightly lower threshold to recover
    if (currentlyBreached) {
      if (comparator === 'GT' || comparator === 'GE') {
        // For > or >=, reduce threshold by hysteresis factor
        effectiveThreshold = threshold * this.HYSTERESIS_FACTOR;
      } else if (comparator === 'LT' || comparator === 'LE') {
        // For < or <=, increase threshold by inverse of hysteresis factor
        effectiveThreshold = threshold / this.HYSTERESIS_FACTOR;
      }
    }

    switch (comparator) {
      case 'GT':
        return value > effectiveThreshold;
      case 'LT':
        return value < effectiveThreshold;
      case 'GE':
        return value >= effectiveThreshold;
      case 'LE':
        return value <= effectiveThreshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert for a rule
   */
  private async triggerAlert(
    rule: AlertRule & { channel: { isEnabled: boolean } },
    currentValue: number,
    state: AlertEvaluationState
  ): Promise<void> {
    // Prevent duplicate alerts within a short time window (5 minutes)
    const now = Date.now();
    if (state.lastTriggeredTime) {
      const timeSinceLastTrigger = now - state.lastTriggeredTime.getTime();
      if (timeSinceLastTrigger < 5 * 60 * 1000) {
        // Skip duplicate alert
        return;
      }
    }

    state.lastTriggeredTime = new Date();

    try {
      // Check if there's already an open incident for this rule
      const incidentModel = new IncidentModel(this.prisma);
      const openIncidents = await incidentModel.list({
        alertRuleId: rule.id,
        status: 'OPEN',
      });

      let incidentId: string;
      if (openIncidents.length > 0) {
        // Use existing incident
        incidentId = openIncidents[0].id;
      } else {
        // Create new incident
        const incident = await incidentModel.create({
          alertRuleId: rule.id,
          startTime: state.breachStartTime || new Date(),
          status: 'OPEN',
          notes: `Alert triggered: ${rule.metricName} = ${currentValue} (threshold: ${rule.comparator} ${rule.threshold})`,
        });
        incidentId = incident.id;
      }

      // Send notification
      const message = this.formatAlertMessage(rule, currentValue);
      await this.notificationService.sendAlert({
        channelId: rule.channelId,
        incidentId,
        alertRuleId: rule.id,
        message,
        metricName: rule.metricName,
        currentValue,
        threshold: rule.threshold,
        comparator: rule.comparator,
      });

      console.log(
        `[AlertingService] Alert triggered for rule ${rule.id} (${rule.name}): ${currentValue} ${rule.comparator} ${rule.threshold}`
      );
    } catch (error) {
      console.error(`[AlertingService] Error triggering alert for rule ${rule.id}:`, error);
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, currentValue: number): string {
    return `🚨 Alert: ${rule.name}\n\n` +
      `Metric: ${rule.metricName}\n` +
      `Current Value: ${currentValue}\n` +
      `Threshold: ${rule.comparator} ${rule.threshold}\n` +
      `${rule.description ? `\nDescription: ${rule.description}\n` : ''}` +
      `\nTriggered at: ${new Date().toISOString()}`;
  }

  /**
   * Get or create evaluation state for a rule
   */
  private getOrCreateState(ruleId: string): AlertEvaluationState {
    if (!this.evaluationStates.has(ruleId)) {
      this.evaluationStates.set(ruleId, {
        ruleId,
        lastEvaluationTime: new Date(),
        thresholdBreached: false,
        breachStartTime: null,
        lastTriggeredTime: null,
        currentValue: null,
      });
    }
    return this.evaluationStates.get(ruleId)!;
  }

  /**
   * Manually trigger evaluation for a specific rule
   */
  async evaluateRuleById(ruleId: string): Promise<void> {
    const alertRuleModel = new AlertRuleModel(this.prisma);
    const rule = await alertRuleModel.findById(ruleId);
    if (rule && rule.isEnabled) {
      await this.evaluateRule(rule);
    }
  }

  /**
   * Get evaluation state for a rule
   */
  getEvaluationState(ruleId: string): AlertEvaluationState | null {
    return this.evaluationStates.get(ruleId) || null;
  }
}


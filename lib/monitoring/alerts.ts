/**
 * Real-Time Alerting System
 *
 * Monitors critical events and sends alerts
 */

import { prisma } from '@/lib/prisma'
import * as Sentry from '@sentry/nextjs'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: (context: any) => boolean
  severity: AlertSeverity
  enabled: boolean
  cooldownMinutes?: number // Prevent alert spam
}

export interface Alert {
  id: string
  ruleId: string
  severity: AlertSeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
  timestamp: Date
}

// Alert rules configuration
const ALERT_RULES: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Error rate exceeds 5% in the last hour',
    condition: (context) => {
      const { errorCount, totalRequests } = context
      return totalRequests > 100 && errorCount / totalRequests > 0.05
    },
    severity: 'critical',
    enabled: true,
    cooldownMinutes: 30,
  },
  {
    id: 'poor-web-vitals',
    name: 'Poor Web Vitals',
    description: 'More than 25% of metrics are rated poor',
    condition: (context) => {
      const { poorCount, totalCount } = context
      return totalCount > 50 && poorCount / totalCount > 0.25
    },
    severity: 'warning',
    enabled: true,
    cooldownMinutes: 60,
  },
  {
    id: 'critical-fraud-alert',
    name: 'Critical Fraud Alert',
    description: 'Critical fraud alert detected',
    condition: (context) => {
      return context.severity === 'critical'
    },
    severity: 'critical',
    enabled: true,
    cooldownMinutes: 5,
  },
  {
    id: 'high-fraud-rate',
    name: 'High Fraud Detection Rate',
    description: 'More than 20% of credentials flagged as fraudulent',
    condition: (context) => {
      const { fraudCount, credentialCount } = context
      return credentialCount > 20 && fraudCount / credentialCount > 0.2
    },
    severity: 'warning',
    enabled: true,
    cooldownMinutes: 120,
  },
  {
    id: 'credential-revocation-spike',
    name: 'Credential Revocation Spike',
    description: 'Unusual spike in credential revocations',
    condition: (context) => {
      const { recentRevocations, baseline } = context
      return recentRevocations > baseline * 3
    },
    severity: 'warning',
    enabled: true,
    cooldownMinutes: 60,
  },
  {
    id: 'database-slow-query',
    name: 'Database Slow Query',
    description: 'Database query took longer than 5 seconds',
    condition: (context) => {
      return context.queryDuration > 5000
    },
    severity: 'warning',
    enabled: true,
    cooldownMinutes: 15,
  },
]

// In-memory cache for alert cooldowns
const alertCooldowns = new Map<string, Date>()

/**
 * Check if alert is in cooldown period
 */
function isInCooldown(ruleId: string, cooldownMinutes: number = 30): boolean {
  const lastAlert = alertCooldowns.get(ruleId)
  if (!lastAlert) return false

  const cooldownEnd = new Date(lastAlert.getTime() + cooldownMinutes * 60 * 1000)
  return new Date() < cooldownEnd
}

/**
 * Set alert cooldown
 */
function setCooldown(ruleId: string) {
  alertCooldowns.set(ruleId, new Date())
}

/**
 * Trigger alert based on rule
 */
export async function triggerAlert(
  ruleId: string,
  context: any,
  additionalMetadata?: Record<string, unknown>
): Promise<void> {
  const rule = ALERT_RULES.find((r) => r.id === ruleId)
  if (!rule || !rule.enabled) return

  // Check cooldown
  if (rule.cooldownMinutes && isInCooldown(ruleId, rule.cooldownMinutes)) {
    console.log(`Alert ${ruleId} is in cooldown, skipping`)
    return
  }

  // Check condition
  if (!rule.condition(context)) {
    return
  }

  const alert: Alert = {
    id: `alert-${Date.now()}-${ruleId}`,
    ruleId,
    severity: rule.severity,
    title: rule.name,
    message: rule.description,
    metadata: {
      ...context,
      ...additionalMetadata,
    },
    timestamp: new Date(),
  }

  // Send alert
  await sendAlert(alert)

  // Set cooldown
  setCooldown(ruleId)
}

/**
 * Send alert through various channels
 */
async function sendAlert(alert: Alert) {
  console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`)
  console.log(`   Message: ${alert.message}`)
  console.log(`   Metadata:`, alert.metadata)

  // Send to Sentry
  Sentry.captureMessage(
    `${alert.title}: ${alert.message}`,
    {
      level: alert.severity === 'critical' ? 'error' : 'warning',
      contexts: {
        alert: {
          id: alert.id,
          ruleId: alert.ruleId,
          severity: alert.severity,
        },
      },
      extra: alert.metadata,
    }
  )

  // Log to database for historical tracking
  try {
    await prisma.errorLog.create({
      data: {
        errorType: 'api',
        message: `${alert.title}: ${alert.message}`,
        metadata: alert.metadata as any,
      },
    })
  } catch (error) {
    console.error('Failed to log alert to database:', error)
  }

  // TODO: Send email/webhook notifications
  // await sendEmailNotification(alert)
  // await sendWebhookNotification(alert)
}

/**
 * Check error rate and trigger alert if needed
 */
export async function checkErrorRate(hours: number = 1) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  const errors = await prisma.errorLog.count({
    where: {
      createdAt: {
        gte: startTime,
      },
    },
  })

  // Approximate total requests (this is a simplified calculation)
  const totalRequests = errors * 20 // Assume 5% error rate baseline

  await triggerAlert('high-error-rate', {
    errorCount: errors,
    totalRequests,
    timeWindow: `${hours}h`,
  })
}

/**
 * Check Web Vitals and trigger alert if needed
 */
export async function checkWebVitals(hours: number = 1) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  const metrics = await prisma.performanceMetric.findMany({
    where: {
      createdAt: {
        gte: startTime,
      },
    },
    select: {
      rating: true,
    },
  })

  const poorCount = metrics.filter((m) => m.rating === 'poor').length
  const totalCount = metrics.length

  await triggerAlert('poor-web-vitals', {
    poorCount,
    totalCount,
    percentage: totalCount > 0 ? (poorCount / totalCount) * 100 : 0,
    timeWindow: `${hours}h`,
  })
}

/**
 * Check fraud detection rate and trigger alert if needed
 */
export async function checkFraudRate(hours: number = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  const fraudAlerts = await prisma.fraudAlert.count({
    where: {
      createdAt: {
        gte: startTime,
      },
      severity: {
        in: ['high', 'critical'],
      },
    },
  })

  const credentials = await prisma.credential.count({
    where: {
      createdAt: {
        gte: startTime,
      },
    },
  })

  await triggerAlert('high-fraud-rate', {
    fraudCount: fraudAlerts,
    credentialCount: credentials,
    percentage: credentials > 0 ? (fraudAlerts / credentials) * 100 : 0,
    timeWindow: `${hours}h`,
  })
}

/**
 * Trigger critical fraud alert immediately
 */
export async function triggerCriticalFraudAlert(credentialId: string, score: number) {
  await triggerAlert('critical-fraud-alert', {
    severity: 'critical',
    credentialId,
    fraudScore: score,
  })
}

/**
 * Check for credential revocation spike
 */
export async function checkRevocationSpike() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const recentRevocations = await prisma.credential.count({
    where: {
      revoked: true,
      revokedAt: {
        gte: oneDayAgo,
      },
    },
  })

  const weeklyRevocations = await prisma.credential.count({
    where: {
      revoked: true,
      revokedAt: {
        gte: oneWeekAgo,
        lt: oneDayAgo,
      },
    },
  })

  const baseline = weeklyRevocations / 7 // Average per day

  await triggerAlert('credential-revocation-spike', {
    recentRevocations,
    baseline,
    multiplier: baseline > 0 ? recentRevocations / baseline : 0,
  })
}

/**
 * Track slow database query
 */
export async function trackSlowQuery(query: string, duration: number) {
  await triggerAlert('database-slow-query', {
    queryDuration: duration,
    query: query.substring(0, 200), // Truncate for logging
  })
}

/**
 * Run all periodic checks
 */
export async function runPeriodicChecks() {
  console.log('Running periodic alert checks...')

  try {
    await Promise.all([
      checkErrorRate(1),
      checkWebVitals(1),
      checkFraudRate(24),
      checkRevocationSpike(),
    ])
  } catch (error) {
    console.error('Error running periodic checks:', error)
  }
}

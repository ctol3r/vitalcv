/**
 * Core Web Vitals Tracking
 *
 * Monitors and reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP)
 */

'use client'

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB, Metric } from 'web-vitals'
import * as Sentry from '@sentry/nextjs'

export type WebVitalMetric = 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'

export interface WebVitalReport {
  id: string
  name: WebVitalMetric
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: string
}

/**
 * Get rating based on metric thresholds
 */
function getRating(metric: Metric): 'good' | 'needs-improvement' | 'poor' {
  const { name, value } = metric

  const thresholds: Record<string, [number, number]> = {
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    FID: [100, 300],
    INP: [200, 500],
    LCP: [2500, 4000],
    TTFB: [800, 1800],
  }

  const [good, poor] = thresholds[name] || [0, 0]

  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Report metric to analytics endpoints
 */
async function reportMetric(metric: Metric) {
  const report: WebVitalReport = {
    id: metric.id,
    name: metric.name as WebVitalMetric,
    value: metric.value,
    rating: getRating(metric),
    delta: metric.delta,
    navigationType: metric.navigationType,
  }

  // Send to Sentry for performance monitoring
  Sentry.setMeasurement(metric.name, metric.value, 'millisecond')

  // Log poor ratings as performance issues
  if (report.rating === 'poor') {
    Sentry.captureMessage(
      `Poor ${metric.name}: ${metric.value.toFixed(2)}`,
      'warning'
    )
  }

  // Send to analytics API
  try {
    await fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
  } catch (error) {
    // Silently fail - don't interrupt user experience
    console.warn('Failed to report web vital:', error)
  }

  // Also send to Vercel Analytics if available
  if (typeof window !== 'undefined' && 'va' in window) {
    ;(window as any).va('event', {
      name: 'web-vital',
      data: report,
    })
  }
}

/**
 * Initialize Core Web Vitals tracking
 */
export function initWebVitals() {
  if (typeof window === 'undefined') return

  // Track all Core Web Vitals
  onCLS(reportMetric)
  onFCP(reportMetric)
  onFID(reportMetric)
  onINP(reportMetric)
  onLCP(reportMetric)
  onTTFB(reportMetric)
}

/**
 * Get threshold for a specific metric
 */
export function getThreshold(
  metric: WebVitalMetric,
  rating: 'good' | 'needs-improvement' | 'poor'
): number {
  const thresholds: Record<WebVitalMetric, [number, number, number]> = {
    CLS: [0.1, 0.25, Infinity],
    FCP: [1800, 3000, Infinity],
    FID: [100, 300, Infinity],
    INP: [200, 500, Infinity],
    LCP: [2500, 4000, Infinity],
    TTFB: [800, 1800, Infinity],
  }

  const [good, needsImprovement, poor] = thresholds[metric]

  switch (rating) {
    case 'good':
      return good
    case 'needs-improvement':
      return needsImprovement
    case 'poor':
      return poor
  }
}

/**
 * Format metric value for display
 */
export function formatMetricValue(metric: WebVitalMetric, value: number): string {
  if (metric === 'CLS') {
    return value.toFixed(3)
  }
  return `${Math.round(value)}ms`
}

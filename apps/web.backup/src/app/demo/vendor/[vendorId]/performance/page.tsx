'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface VendorPerformanceProps {
  vendorId: string
}

interface PerformanceMetric {
  id: string
  name: string
  value: number
  threshold: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  period: string
}

interface KPIData {
  uptime: PerformanceMetric
  deliveryTime: PerformanceMetric
  qualityScore: PerformanceMetric
  responseTime: PerformanceMetric
  customerSatisfaction: PerformanceMetric
}

interface PerformanceHistory {
  date: string
  metrics: {
    [key: string]: number
  }
}

export default function VendorPerformanceHistoryPage() {
  const params = useParams()
  const vendorId = params.vendorId as string

  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [history, setHistory] = useState<PerformanceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  useEffect(() => {
    fetchPerformanceData()
  }, [vendorId, selectedPeriod])

  async function fetchPerformanceData() {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/demo/vendor/${vendorId}/performance?period=${selectedPeriod}`
      )
      if (!response.ok) throw new Error('Failed to fetch performance data')
      const payload = await response.json()
      setKpis(payload.kpis)
      setHistory(payload.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function getTrendIcon(trend: 'up' | 'down' | 'stable') {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  function getMetricStatus(value: number, threshold: number) {
    const percentage = (value / threshold) * 100
    if (percentage >= 100) {
      return { status: 'excellent', color: 'bg-green-600' }
    } else if (percentage >= 80) {
      return { status: 'good', color: 'bg-yellow-600' }
    } else {
      return { status: 'poor', color: 'bg-red-600' }
    }
  }

  function formatMetricValue(value: number, unit: string) {
    if (unit === 'percentage') {
      return `${value.toFixed(1)}%`
    } else if (unit === 'hours') {
      return `${value.toFixed(1)}h`
    } else if (unit === 'minutes') {
      return `${value.toFixed(0)}m`
    } else if (unit === 'days') {
      return `${value.toFixed(1)}d`
    }
    return value.toFixed(2)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-muted-foreground">Loading performance data...</div>
      </div>
    )
  }

  if (error || !kpis) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-destructive">Error: {error || 'Performance data not found'}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance metrics and KPIs over time
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatMetricValue(kpis.uptime.value, kpis.uptime.unit)}
                </span>
                {getTrendIcon(kpis.uptime.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target: {formatMetricValue(kpis.uptime.threshold, kpis.uptime.unit)}</span>
                  <span className="text-muted-foreground">{kpis.uptime.period}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getMetricStatus(kpis.uptime.value, kpis.uptime.threshold).color}`}
                    style={{
                      width: `${Math.min((kpis.uptime.value / kpis.uptime.threshold) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delivery Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatMetricValue(kpis.deliveryTime.value, kpis.deliveryTime.unit)}
                </span>
                {getTrendIcon(kpis.deliveryTime.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target: {formatMetricValue(kpis.deliveryTime.threshold, kpis.deliveryTime.unit)}</span>
                  <span className="text-muted-foreground">{kpis.deliveryTime.period}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getMetricStatus(kpis.deliveryTime.value, kpis.deliveryTime.threshold).color}`}
                    style={{
                      width: `${Math.min((kpis.deliveryTime.threshold / kpis.deliveryTime.value) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatMetricValue(kpis.qualityScore.value, kpis.qualityScore.unit)}
                </span>
                {getTrendIcon(kpis.qualityScore.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target: {formatMetricValue(kpis.qualityScore.threshold, kpis.qualityScore.unit)}</span>
                  <span className="text-muted-foreground">{kpis.qualityScore.period}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getMetricStatus(kpis.qualityScore.value, kpis.qualityScore.threshold).color}`}
                    style={{
                      width: `${Math.min((kpis.qualityScore.value / kpis.qualityScore.threshold) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatMetricValue(kpis.responseTime.value, kpis.responseTime.unit)}
                </span>
                {getTrendIcon(kpis.responseTime.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target: {formatMetricValue(kpis.responseTime.threshold, kpis.responseTime.unit)}</span>
                  <span className="text-muted-foreground">{kpis.responseTime.period}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getMetricStatus(kpis.responseTime.value, kpis.responseTime.threshold).color}`}
                    style={{
                      width: `${Math.min((kpis.responseTime.threshold / kpis.responseTime.value) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatMetricValue(kpis.customerSatisfaction.value, kpis.customerSatisfaction.unit)}
                </span>
                {getTrendIcon(kpis.customerSatisfaction.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target: {formatMetricValue(kpis.customerSatisfaction.threshold, kpis.customerSatisfaction.unit)}</span>
                  <span className="text-muted-foreground">{kpis.customerSatisfaction.period}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getMetricStatus(kpis.customerSatisfaction.value, kpis.customerSatisfaction.threshold).color}`}
                    style={{
                      width: `${Math.min((kpis.customerSatisfaction.value / kpis.customerSatisfaction.threshold) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance History */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            Historical performance data over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Performance metrics are calculated based on:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>
                  <strong>Uptime:</strong> Percentage of time services are available (target: 99.9%)
                </li>
                <li>
                  <strong>Delivery Time:</strong> Average time to deliver services (target: within SLA)
                </li>
                <li>
                  <strong>Quality Score:</strong> Based on error rates and defect counts (target: 95%+)
                </li>
                <li>
                  <strong>Response Time:</strong> Average time to respond to requests (target: &lt; 24h)
                </li>
                <li>
                  <strong>Customer Satisfaction:</strong> Based on feedback and ratings (target: 4.0/5.0)
                </li>
              </ul>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Note:</strong> Performance data is updated daily. Historical trends show
                  the vendor's performance over time, helping identify areas for improvement or
                  recognition of excellent service delivery.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No historical data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


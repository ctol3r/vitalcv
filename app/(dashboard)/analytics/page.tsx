/**
 * Analytics Dashboard Page
 *
 * Comprehensive analytics and monitoring dashboard
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertCircle, CheckCircle, Shield, TrendingUp, XCircle, Zap } from 'lucide-react'
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'

interface AnalyticsData {
  timeRange: string
  startDate: string
  endDate: string
  webVitals: Record<string, any>
  errors: any
  credentials: any
  verifications: any
  fraudAlerts: any
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('24h')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/metrics?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    )
  }

  const webVitalsData = Object.entries(analytics.webVitals).map(([name, data]: [string, any]) => ({
    name,
    average: Math.round(data.average),
    p75: Math.round(data.p75),
    p95: Math.round(data.p95),
    good: data.ratings.good,
    needsImprovement: data.ratings.needsImprovement,
    poor: data.ratings.poor,
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitor performance, errors, and system health</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credentials Issued</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.credentials.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.credentials.active} active, {analytics.credentials.revoked} revoked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verifications</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.verifications.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.verifications.byResult.valid} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.fraudAlerts.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.fraudAlerts.unreviewed} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.errors.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.errors.unresolved} unresolved
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals</CardTitle>
              <CardDescription>Performance metrics across all pages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={webVitalsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="average" fill="#3b82f6" name="Average" />
                  <Bar dataKey="p75" fill="#8b5cf6" name="75th Percentile" />
                  <Bar dataKey="p95" fill="#ef4444" name="95th Percentile" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(analytics.webVitals).map(([name, data]: [string, any]) => (
              <Card key={name}>
                <CardHeader>
                  <CardTitle className="text-lg">{name}</CardTitle>
                  <CardDescription>{data.count} measurements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average:</span>
                    <span className="font-medium">{Math.round(data.average)}{name === 'CLS' ? '' : 'ms'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Median:</span>
                    <span className="font-medium">{Math.round(data.median)}{name === 'CLS' ? '' : 'ms'}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {data.ratings.good} good
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      {data.ratings.needsImprovement} fair
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {data.ratings.poor} poor
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>Errors by type and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Errors:</span>
                  <Badge variant="destructive">{analytics.errors.total}</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Client Errors:</span>
                    <span className="font-medium">{analytics.errors.byType.client}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Server Errors:</span>
                    <span className="font-medium">{analytics.errors.byType.server}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">API Errors:</span>
                    <span className="font-medium">{analytics.errors.byType.api}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Validation Errors:</span>
                    <span className="font-medium">{analytics.errors.byType.validation}</span>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Resolved:</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {analytics.errors.resolved}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Unresolved:</span>
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {analytics.errors.unresolved}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Credential Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Issued:</span>
                  <Badge>{analytics.credentials.total}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {analytics.credentials.active}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Revoked:</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    {analytics.credentials.revoked}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total:</span>
                  <Badge>{analytics.verifications.total}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valid:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {analytics.verifications.byResult.valid}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invalid:</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    {analytics.verifications.byResult.invalid}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expired:</span>
                  <span className="font-medium">{analytics.verifications.byResult.expired}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fraud" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Detection Summary</CardTitle>
              <CardDescription>AI-powered fraud detection alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Alerts:</span>
                <Badge>{analytics.fraudAlerts.total}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Critical:</span>
                  <Badge variant="destructive">{analytics.fraudAlerts.bySeverity.critical}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">High:</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    {analytics.fraudAlerts.bySeverity.high}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Medium:</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                    {analytics.fraudAlerts.bySeverity.medium}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Low:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {analytics.fraudAlerts.bySeverity.low}
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Reviewed:</span>
                  <span className="font-medium">{analytics.fraudAlerts.reviewed}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Pending Review:</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                    {analytics.fraudAlerts.unreviewed}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

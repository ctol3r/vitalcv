"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  Clock,
  Activity,
  BarChart3,
  RefreshCw,
  Download,
} from "lucide-react"
import { AnalyticsChart } from "@/components/AnalyticsChart"
import { SessionAnalyticsWidget } from "@/components/SessionAnalyticsWidget"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface AnalyticsData {
  metrics: {
    confidenceScore: number
    fraudAlerts: number
    successRate: number
    totalVerifications: number
    avgVerificationTime: number
    activeCredentials: number
    revocationRate: number
    p50VerificationTime: number
    p95VerificationTime: number
  }
  trends: {
    successRate: Array<{ name: string; value: number }>
    revocations: Array<{ name: string; value: number }>
    verificationTimes: Array<{ name: string; p50: number; p95: number }>
    volumeTrends: Array<{ name: string; value: number }>
    fraudDetection: Array<{ name: string; detected: number; prevented: number }>
    credentialTypes: Array<{ name: string; value: number }>
  }
  recentAlerts: Array<{
    id: number
    type: string
    message: string
    timestamp: string
    severity: string
  }>
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const { toast } = useToast()

  const fetchAnalytics = async (showRefreshToast = false) => {
    const isRefresh = showRefreshToast
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`)
      }

      const analyticsData = await response.json()
      setData(analyticsData)

      if (isRefresh) {
        toast({
          title: "Data Refreshed",
          description: "Analytics data has been updated successfully",
        })
      }
    } catch (err) {
      // Fallback to mock data if API fails
      const mockData: AnalyticsData = {
        metrics: {
          confidenceScore: 94,
          fraudAlerts: 3,
          successRate: 98.2,
          totalVerifications: 1247,
          avgVerificationTime: 2.3,
          activeCredentials: 892,
          revocationRate: 1.8,
          p50VerificationTime: 1.8,
          p95VerificationTime: 4.2,
        },
        trends: {
          successRate: [
            { name: "Week 1", value: 97.5 },
            { name: "Week 2", value: 98.1 },
            { name: "Week 3", value: 97.8 },
            { name: "Week 4", value: 98.2 },
          ],
          revocations: [
            { name: "Week 1", value: 5 },
            { name: "Week 2", value: 3 },
            { name: "Week 3", value: 7 },
            { name: "Week 4", value: 4 },
          ],
          verificationTimes: [
            { name: "Week 1", p50: 2.1, p95: 4.8 },
            { name: "Week 2", p50: 1.9, p95: 4.2 },
            { name: "Week 3", p50: 1.7, p95: 3.9 },
            { name: "Week 4", p50: 1.8, p95: 4.2 },
          ],
          volumeTrends: [
            { name: "Jan", value: 850 },
            { name: "Feb", value: 920 },
            { name: "Mar", value: 1100 },
            { name: "Apr", value: 1247 },
          ],
          fraudDetection: [
            { name: "Jan", detected: 10, prevented: 5 },
            { name: "Feb", detected: 15, prevented: 8 },
            { name: "Mar", detected: 20, prevented: 12 },
            { name: "Apr", detected: 25, prevented: 15 },
          ],
          credentialTypes: [
            { name: "Type A", value: 400 },
            { name: "Type B", value: 300 },
            { name: "Type C", value: 547 },
          ],
        },
        recentAlerts: [
          {
            id: 1,
            type: "fraud",
            message: "Suspicious credential pattern detected in CRED-99887",
            timestamp: "2 hours ago",
            severity: "high",
          },
          {
            id: 2,
            type: "expiry",
            message: "15 credentials expiring in the next 30 days",
            timestamp: "4 hours ago",
            severity: "medium",
          },
          {
            id: 3,
            type: "system",
            message: "Blockchain sync completed successfully",
            timestamp: "6 hours ago",
            severity: "low",
          },
        ],
      }
      setData(mockData)

      toast({
        title: "Using Demo Data",
        description: "Analytics API unavailable, showing demo data",
        variant: "default",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertDescription>Failed to load analytics data</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <SessionAnalyticsWidget />

        <div className="mt-12 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Analytics Dashboard</h1>
            <p className="text-lg text-gray-600">
              Monitor verification performance, fraud detection, and system health
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="bg-transparent"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <div className="flex items-center gap-2">
              <label htmlFor="timeRange" className="text-sm font-medium text-gray-700">
                Time Range:
              </label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.metrics.successRate}%</div>
              <p className="text-xs text-gray-600">Verification success rate</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revocation Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.metrics.revocationRate}%</div>
              <p className="text-xs text-gray-600">Credentials revoked</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">P50 Verify Time</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.metrics.p50VerificationTime}s</div>
              <p className="text-xs text-gray-600">Median verification time</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">P95 Verify Time</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{data.metrics.p95VerificationTime}s</div>
              <p className="text-xs text-gray-600">95th percentile time</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confidence Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.metrics.confidenceScore}%</div>
              <p className="text-xs text-gray-600">+2.1% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.metrics.fraudAlerts}</div>
              <p className="text-xs text-gray-600">Active alerts requiring attention</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {data.metrics.totalVerifications.toLocaleString()}
              </div>
              <p className="text-xs text-gray-600">This period</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Active Credentials
              </CardTitle>
              <CardDescription>Currently tracked credentials</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {data.metrics.activeCredentials.toLocaleString()}
              </div>
              <p className="text-xs text-gray-600">Credentials in use</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <AnalyticsChart
            title="Success Rate Trends"
            type="line"
            data={data.trends.successRate}
            description="Verification success rate over time"
          />

          <AnalyticsChart
            title="Fraud Detection"
            type="composed"
            data={data.trends.fraudDetection}
            dataKeys={["detected", "prevented"]}
            colors={["#EF4444", "#10B981"]}
            description="Fraud cases detected vs prevented"
          />
        </div>

        {/* Credential Types Pie Chart and Volume Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <AnalyticsChart
            title="Credential Types"
            type="pie"
            data={data.trends.credentialTypes}
            description="Distribution of credential types verified"
          />

          <AnalyticsChart
            title="Verification Volume"
            type="bar"
            data={data.trends.volumeTrends}
            description="Number of verifications over time"
          />
        </div>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Verification Time Distribution
              </CardTitle>
              <CardDescription>P50 vs P95 verification times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <div className="space-y-4">
                  {data.trends.verificationTimes.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="text-gray-500">
                          P50: {item.p50}s | P95: {item.p95}s
                        </span>
                      </div>
                      <div className="flex gap-1 h-6">
                        <div className="bg-blue-500 rounded-l" style={{ width: `${(item.p50 / 5) * 100}%` }} />
                        <div
                          className="bg-blue-300 rounded-r"
                          style={{ width: `${((item.p95 - item.p50) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ... existing verification volume chart ... */}
        </div>

        {/* Recent Alerts */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>Latest fraud detection and system alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentAlerts.map((alert) => (
                <Alert key={alert.id} className="border-l-4 border-l-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="flex items-center justify-between">
                    <AlertDescription className="flex-1">{alert.message}</AlertDescription>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          alert.severity === "high"
                            ? "destructive"
                            : alert.severity === "medium"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {alert.severity}
                      </Badge>
                      <span className="text-xs text-gray-500">{alert.timestamp}</span>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

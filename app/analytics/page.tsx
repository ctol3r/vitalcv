"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Users, Clock } from "lucide-react"
import { AnalyticsChart } from "@/components/AnalyticsChart"
import Link from "next/link"

export default function AnalyticsPage() {
  // Mock data
  const metrics = {
    confidenceScore: 94,
    fraudAlerts: 3,
    successRate: 98.2,
    totalVerifications: 1247,
    avgVerificationTime: 2.3,
    activeCredentials: 892,
  }

  const recentAlerts = [
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
  ]

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
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Analytics Dashboard</h1>
          <p className="text-lg text-gray-600">Monitor verification performance, fraud detection, and system health</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confidence Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.confidenceScore}%</div>
              <p className="text-xs text-gray-600">+2.1% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.fraudAlerts}</div>
              <p className="text-xs text-gray-600">Active alerts requiring attention</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.successRate}%</div>
              <p className="text-xs text-gray-600">Verification success rate</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{metrics.totalVerifications.toLocaleString()}</div>
              <p className="text-xs text-gray-600">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Verification Time</CardTitle>
              <Clock className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-600">{metrics.avgVerificationTime}s</div>
              <p className="text-xs text-gray-600">-0.5s from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Credentials</CardTitle>
              <Shield className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{metrics.activeCredentials.toLocaleString()}</div>
              <p className="text-xs text-gray-600">Currently tracked</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <AnalyticsChart
            title="Verification Trends"
            type="line"
            data={[
              { name: "Jan", value: 850 },
              { name: "Feb", value: 920 },
              { name: "Mar", value: 1100 },
              { name: "Apr", value: 1247 },
            ]}
          />

          <AnalyticsChart
            title="Credential Types"
            type="pie"
            data={[
              { name: "Medical License", value: 45 },
              { name: "Board Certification", value: 30 },
              { name: "DEA Registration", value: 15 },
              { name: "Other", value: 10 },
            ]}
          />
        </div>

        {/* Recent Alerts */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>Latest fraud detection and system alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert) => (
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

import { type NextRequest, NextResponse } from "next/server"

interface AnalyticsMetrics {
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

interface AnalyticsTrends {
  successRate: Array<{ name: string; value: number }>
  revocations: Array<{ name: string; value: number }>
  verificationTimes: Array<{ name: string; p50: number; p95: number }>
  volumeTrends: Array<{ name: string; value: number }>
  fraudDetection: Array<{ name: string; detected: number; prevented: number }>
  credentialTypes: Array<{ name: string; value: number }>
}

interface RecentAlert {
  id: number
  type: "fraud" | "expiry" | "system" | "performance"
  message: string
  timestamp: string
  severity: "low" | "medium" | "high" | "critical"
  credentialId?: string
  actionRequired?: boolean
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("timeRange") || "30d"

    // TODO(@backend-integration): Replace with actual backend analytics service call
    // STUB: For now, generate realistic mock data based on time range
    const mockData = generateMockAnalytics(timeRange)

    return NextResponse.json(mockData, { status: 200 })
  } catch (error) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 })
  }
}

function generateMockAnalytics(timeRange: string) {
  const baseMetrics: AnalyticsMetrics = {
    confidenceScore: 94 + Math.random() * 4, // 94-98%
    fraudAlerts: Math.floor(Math.random() * 8) + 1, // 1-8 alerts
    successRate: 96 + Math.random() * 3, // 96-99%
    totalVerifications: Math.floor(Math.random() * 500) + 1000, // 1000-1500
    avgVerificationTime: 1.5 + Math.random() * 2, // 1.5-3.5s
    activeCredentials: Math.floor(Math.random() * 300) + 800, // 800-1100
    revocationRate: Math.random() * 3 + 0.5, // 0.5-3.5%
    p50VerificationTime: 1.2 + Math.random() * 1.5, // 1.2-2.7s
    p95VerificationTime: 3.5 + Math.random() * 2, // 3.5-5.5s
  }

  const trends: AnalyticsTrends = {
    successRate: generateTrendData("success", timeRange, 95, 99),
    revocations: generateTrendData("revocations", timeRange, 2, 12),
    verificationTimes: generateVerificationTimeTrends(timeRange),
    volumeTrends: generateTrendData("volume", timeRange, 800, 1500),
    fraudDetection: generateFraudTrends(timeRange),
    credentialTypes: [
      { name: "Medical License", value: 45 },
      { name: "Nursing License", value: 28 },
      { name: "Pharmacy License", value: 15 },
      { name: "Dental License", value: 8 },
      { name: "Other", value: 4 },
    ],
  }

  const recentAlerts: RecentAlert[] = [
    {
      id: 1,
      type: "fraud",
      message: "Suspicious credential pattern detected in CRED-99887",
      timestamp: "2 hours ago",
      severity: "high",
      credentialId: "CRED-99887",
      actionRequired: true,
    },
    {
      id: 2,
      type: "expiry",
      message: "15 credentials expiring in the next 30 days",
      timestamp: "4 hours ago",
      severity: "medium",
      actionRequired: true,
    },
    {
      id: 3,
      type: "system",
      message: "Blockchain sync completed successfully",
      timestamp: "6 hours ago",
      severity: "low",
      actionRequired: false,
    },
    {
      id: 4,
      type: "performance",
      message: "P95 verification time exceeded threshold (6.2s)",
      timestamp: "8 hours ago",
      severity: "medium",
      actionRequired: true,
    },
    {
      id: 5,
      type: "fraud",
      message: "Potential duplicate credential detected",
      timestamp: "12 hours ago",
      severity: "critical",
      credentialId: "CRED-44521",
      actionRequired: true,
    },
  ]

  return {
    metrics: baseMetrics,
    trends,
    recentAlerts,
    lastUpdated: new Date().toISOString(),
    timeRange,
  }
}

function generateTrendData(type: string, timeRange: string, min: number, max: number) {
  const periods = getPeriodsForTimeRange(timeRange)
  return periods.map((period, index) => ({
    name: period,
    value: Math.floor(min + Math.random() * (max - min) + Math.sin(index) * 10),
  }))
}

function generateVerificationTimeTrends(timeRange: string) {
  const periods = getPeriodsForTimeRange(timeRange)
  return periods.map(() => ({
    name: periods[Math.floor(Math.random() * periods.length)],
    p50: 1.2 + Math.random() * 1.5,
    p95: 3.5 + Math.random() * 2,
  }))
}

function generateFraudTrends(timeRange: string) {
  const periods = getPeriodsForTimeRange(timeRange)
  return periods.map((period) => ({
    name: period,
    detected: Math.floor(Math.random() * 15) + 2,
    prevented: Math.floor(Math.random() * 12) + 1,
  }))
}

function getPeriodsForTimeRange(timeRange: string): string[] {
  switch (timeRange) {
    case "7d":
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    case "30d":
      return ["Week 1", "Week 2", "Week 3", "Week 4"]
    case "90d":
      return ["Month 1", "Month 2", "Month 3"]
    case "1y":
      return ["Q1", "Q2", "Q3", "Q4"]
    default:
      return ["Week 1", "Week 2", "Week 3", "Week 4"]
  }
}

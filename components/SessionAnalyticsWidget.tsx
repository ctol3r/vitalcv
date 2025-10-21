"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileCheck, Shield, XCircle, RefreshCw } from "lucide-react"
import { useSessionAnalytics } from "@/hooks/use-session-analytics"

export function SessionAnalyticsWidget() {
  const { analytics, resetAnalytics } = useSessionAnalytics()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Session Metrics</h2>
          <p className="text-sm text-gray-600">Activity counters for this session</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetAnalytics} aria-label="Reset session counters">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset Counters
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credentials Issued</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{analytics.credentialsIssued}</div>
            <p className="text-xs text-gray-600 mt-1">This session</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verifications Performed</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{analytics.verificationsPerformed}</div>
            <p className="text-xs text-gray-600 mt-1">This session</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revocations Executed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{analytics.revocationsExecuted}</div>
            <p className="text-xs text-gray-600 mt-1">This session</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

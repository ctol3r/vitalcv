"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

interface LifecycleItem {
  id: string
  clinicianName: string
  credentialType: string
  phase: 'initial' | 'recheck' | 'renewal' | 'expired'
  nextCheck: string
  riskLevel: 'low' | 'medium' | 'high'
}

// Mock data until API is connected
const MOCK_DATA: LifecycleItem[] = [
  {
    id: '1',
    clinicianName: 'Dr. Sarah Smith',
    credentialType: 'DEA Registration',
    phase: 'renewal',
    nextCheck: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days
    riskLevel: 'medium',
  },
  {
    id: '2',
    clinicianName: 'Dr. James Wilson',
    credentialType: 'State License (CA)',
    phase: 'recheck',
    nextCheck: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days
    riskLevel: 'low',
  },
  {
    id: '3',
    clinicianName: 'Dr. Emily Chen',
    credentialType: 'Board Certification',
    phase: 'expired',
    nextCheck: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    riskLevel: 'high',
  },
  {
    id: '4',
    clinicianName: 'Dr. Michael Brown',
    credentialType: 'State License (NY)',
    phase: 'initial',
    nextCheck: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(), // 180 days
    riskLevel: 'low',
  },
]

export default function ComplianceForecastPage() {
  const [items, setItems] = useState<LifecycleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // In a real implementation, fetch from /api/compliance/forecast
    setTimeout(() => {
      setItems(MOCK_DATA)
      setIsLoading(false)
    }, 1000)
  }, [])

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'renewal': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Renewal Due</Badge>
      case 'expired': return <Badge variant="destructive">Expired</Badge>
      case 'recheck': return <Badge variant="secondary">Recheck Scheduled</Badge>
      case 'initial': return <Badge variant="outline">Good Standing</Badge>
      default: return <Badge>{phase}</Badge>
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 font-bold'
      case 'medium': return 'text-orange-600'
      default: return 'text-green-600'
    }
  }

  const stats = {
    renewals: items.filter(i => i.phase === 'renewal').length,
    expired: items.filter(i => i.phase === 'expired').length,
    highRisk: items.filter(i => i.riskLevel === 'high').length,
    upcomingChecks: items.length
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Forecast</h1>
          <p className="text-muted-foreground mt-2">
            AI-driven projection of compliance lifecycle events and renewals.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Forecast
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Renewals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.renewals}</div>
            <p className="text-xs text-muted-foreground">Within next 90 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Credentials</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Action required immediately</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Clinicians</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.highRisk}</div>
            <p className="text-xs text-muted-foreground">Based on adverse actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Checks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingChecks}</div>
            <p className="text-xs text-muted-foreground">Automated monitoring queue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Schedule</CardTitle>
          <CardDescription>Predicted compliance events and required actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Loading forecast...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Next Check</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.clinicianName}</TableCell>
                    <TableCell>{item.credentialType}</TableCell>
                    <TableCell>{getPhaseBadge(item.phase)}</TableCell>
                    <TableCell>{format(new Date(item.nextCheck), 'MMM d, yyyy')}</TableCell>
                    <TableCell className={getRiskColor(item.riskLevel)}>
                      {item.riskLevel.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">View Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


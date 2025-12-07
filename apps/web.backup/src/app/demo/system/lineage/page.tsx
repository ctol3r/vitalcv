'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RecordLineageViewer } from '@/components/lineage/RecordLineageViewer'
import { AccessLogsExplorer } from '@/components/lineage/AccessLogsExplorer'
import { ExplainabilityReport } from '@/components/lineage/ExplainabilityReport'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  Database,
  Filter,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'

interface LineageMetrics {
  mostActiveDataSources: Array<{
    source: string
    recordCount: number
    transformationCount: number
  }>
  transformationCounts: Array<{
    transformationId: string
    name: string
    count: number
    riskClassification: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }>
  riskScores: {
    overall: number
    bySource: Array<{
      source: string
      score: number
    }>
  }
}

const MOCK_METRICS: LineageMetrics = {
  mostActiveDataSources: [
    { source: 'credentials', recordCount: 1247, transformationCount: 342 },
    { source: 'reputation', recordCount: 892, transformationCount: 156 },
    { source: 'finance', recordCount: 634, transformationCount: 89 },
    { source: 'privileges', recordCount: 445, transformationCount: 234 },
  ],
  transformationCounts: [
    {
      transformationId: 'ai-link-inference',
      name: 'AI Link Inference',
      count: 342,
      riskClassification: 'MEDIUM',
    },
    {
      transformationId: 'reputation-calculation',
      name: 'Reputation Score Calculation',
      count: 156,
      riskClassification: 'HIGH',
    },
    {
      transformationId: 'privilege-evaluation',
      name: 'Privilege Evaluation',
      count: 234,
      riskClassification: 'MEDIUM',
    },
    {
      transformationId: 'credential-verification',
      name: 'Credential Verification',
      count: 89,
      riskClassification: 'LOW',
    },
  ],
  riskScores: {
    overall: 0.72,
    bySource: [
      { source: 'credentials', score: 0.65 },
      { source: 'reputation', score: 0.78 },
      { source: 'finance', score: 0.82 },
      { source: 'privileges', score: 0.71 },
    ],
  },
}

export default function LineageDashboardPage() {
  const [timeFilter, setTimeFilter] = useState<string>('7d')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null)

  const filteredMetrics = useMemo(() => {
    // In production, this would filter based on timeFilter and serviceFilter
    return MOCK_METRICS
  }, [timeFilter, serviceFilter])

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskBadgeVariant = (classification: string) => {
    switch (classification) {
      case 'LOW':
        return 'default'
      case 'MEDIUM':
        return 'secondary'
      case 'HIGH':
        return 'destructive'
      case 'CRITICAL':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lineage Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track data transformations, provenance, and access patterns
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="credentials">Credentials</SelectItem>
              <SelectItem value="reputation">Reputation</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="privileges">Privileges</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMetrics.mostActiveDataSources.reduce(
                (sum, ds) => sum + ds.recordCount,
                0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Across all data sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transformations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMetrics.transformationCounts.reduce((sum, t) => sum + t.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total transformations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getRiskColor(filteredMetrics.riskScores.overall))}>
              {(filteredMetrics.riskScores.overall * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Overall lineage risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMetrics.mostActiveDataSources.length}</div>
            <p className="text-xs text-muted-foreground">Data sources tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Most Active Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Most Active Data Sources</CardTitle>
          <CardDescription>Data sources with highest record and transformation counts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Transformations</TableHead>
                <TableHead>Risk Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMetrics.mostActiveDataSources.map((source) => {
                const riskScore =
                  filteredMetrics.riskScores.bySource.find((r) => r.source === source.source)
                    ?.score || 0
                return (
                  <TableRow key={source.source}>
                    <TableCell className="font-medium">{source.source}</TableCell>
                    <TableCell>{source.recordCount.toLocaleString()}</TableCell>
                    <TableCell>{source.transformationCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={cn('font-medium', getRiskColor(riskScore))}>
                        {(riskScore * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transformation Counts */}
      <Card>
        <CardHeader>
          <CardTitle>Transformation Counts</CardTitle>
          <CardDescription>Number of transformations by type and risk classification</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transformation</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Risk Classification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMetrics.transformationCounts.map((transformation) => (
                <TableRow key={transformation.transformationId}>
                  <TableCell className="font-medium">{transformation.name}</TableCell>
                  <TableCell>{transformation.count.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={getRiskBadgeVariant(transformation.riskClassification)}>
                      {transformation.riskClassification}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Lineage Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>Record Lineage Viewer</CardTitle>
          <CardDescription>Visualize lineage for a specific record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Enter record ID to view lineage..."
              value={selectedRecordId || ''}
              onChange={(e) => setSelectedRecordId(e.target.value || null)}
              className="max-w-md"
            />
          </div>
          {selectedRecordId && (
            <RecordLineageViewer recordId={selectedRecordId} />
          )}
        </CardContent>
      </Card>

      {/* Access Logs Explorer */}
      <Card>
        <CardHeader>
          <CardTitle>Access Logs Explorer</CardTitle>
          <CardDescription>Search and filter data access logs</CardDescription>
        </CardHeader>
        <CardContent>
          <AccessLogsExplorer />
        </CardContent>
      </Card>

      {/* Explainability Report */}
      <Card>
        <CardHeader>
          <CardTitle>Explainability Report</CardTitle>
          <CardDescription>View explanations for credential decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Enter credential ID to view explanation..."
              value={selectedCredentialId || ''}
              onChange={(e) => setSelectedCredentialId(e.target.value || null)}
              className="max-w-md"
            />
          </div>
          {selectedCredentialId && (
            <ExplainabilityReport credentialId={selectedCredentialId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}


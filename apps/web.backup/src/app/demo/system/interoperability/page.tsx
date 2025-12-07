'use client'

import { useMemo, useState } from 'react'
import { Network, Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ConnectorSource = 'TEFCA' | 'LICENSING_BOARD' | 'BLOCKCHAIN' | 'FHIR'

type DataFlowMetric = {
  source: ConnectorSource
  eventsPerHour: number
  averageLag: number // in seconds
  errorRate: number // percentage
  lastEventTime: string
  status: 'healthy' | 'degraded' | 'error'
}

type ComplianceMismatch = {
  id: string
  source: ConnectorSource
  severity: 'low' | 'medium' | 'high'
  description: string
  detectedAt: string
  resolved: boolean
}

type ChainHealth = {
  chainId: string
  chainName: string
  health: number // 0-100
  transactionsPerHour: number
  averageConfirmationTime: number // in seconds
  status: 'healthy' | 'degraded' | 'error'
}

export default function InteroperabilityDashboardPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d'>('24h')
  const [srMessage, setSrMessage] = useState('')

  const dataFlowMetrics = useMemo(() => buildMockDataFlowMetrics(), [])
  const complianceMismatches = useMemo(() => buildMockComplianceMismatches(), [])
  const chainHealth = useMemo(() => buildMockChainHealth(), [])

  const totalEvents = useMemo(() => dataFlowMetrics.reduce((sum, m) => sum + m.eventsPerHour, 0), [dataFlowMetrics])
  const averageLag = useMemo(() => {
    const sum = dataFlowMetrics.reduce((acc, m) => acc + m.averageLag, 0)
    return sum / dataFlowMetrics.length
  }, [dataFlowMetrics])
  const totalErrors = useMemo(() => {
    const sum = dataFlowMetrics.reduce((acc, m) => acc + (m.eventsPerHour * m.errorRate) / 100, 0)
    return Math.round(sum)
  }, [dataFlowMetrics])
  const unresolvedMismatches = useMemo(() => complianceMismatches.filter((m) => !m.resolved).length, [complianceMismatches])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • System • Interoperability</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Network className="h-8 w-8 text-primary" aria-hidden="true" />
              Interoperability Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Visualize data flow across external connectors: events per source, lag, errors, and compliance mismatches. Includes heat maps for multi-chain health.
            </p>
          </div>
          <div className="flex gap-2">
            {(['1h', '24h', '7d'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedTimeRange(range)
                  setSrMessage(`Viewing data for ${range === '1h' ? '1 hour' : range === '24h' ? '24 hours' : '7 days'}`)
                  setTimeout(() => setSrMessage(''), 2000)
                }}
              >
                {range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : '7 Days'}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-4" aria-label="Interoperability summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Events/Hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEvents.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Across all sources</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Avg Lag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{averageLag.toFixed(1)}s</p>
            <p className="text-sm text-muted-foreground">Processing delay</p>
          </CardContent>
        </Card>
        <Card className={totalErrors > 0 ? 'border-rose-200 bg-rose-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
              Errors/Hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-600">{totalErrors}</p>
            <p className="text-sm text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card className={unresolvedMismatches > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Compliance Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{unresolvedMismatches}</p>
            <p className="text-sm text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="dataflow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dataflow">Data Flow</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="chains">Multi-Chain Health</TabsTrigger>
        </TabsList>

        {/* Data Flow Tab */}
        <TabsContent value="dataflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Flow Metrics</CardTitle>
              <CardDescription>Events per source, lag, and error rates across connectors.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Events/Hour</TableHead>
                    <TableHead>Avg Lag</TableHead>
                    <TableHead>Error Rate</TableHead>
                    <TableHead>Last Event</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataFlowMetrics.map((metric) => (
                    <TableRow key={metric.source}>
                      <TableCell className="font-semibold">
                        <Badge variant="outline" className="capitalize">
                          {metric.source.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          {metric.eventsPerHour.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {metric.averageLag > 10 ? (
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-emerald-600" />
                          )}
                          {metric.averageLag.toFixed(1)}s
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${metric.errorRate > 5 ? 'bg-rose-600' : metric.errorRate > 1 ? 'bg-amber-600' : 'bg-emerald-600'}`}
                              style={{ width: `${Math.min(metric.errorRate * 10, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm">{metric.errorRate.toFixed(2)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{metric.lastEventTime}</TableCell>
                      <TableCell>
                        <StatusBadge status={metric.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Mismatches</CardTitle>
              <CardDescription>Detected compliance issues across external connectors.</CardDescription>
            </CardHeader>
            <CardContent>
              {complianceMismatches.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
                  <p className="text-muted-foreground">No compliance mismatches detected</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceMismatches.map((mismatch) => (
                      <TableRow key={mismatch.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {mismatch.source.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={mismatch.severity} />
                        </TableCell>
                        <TableCell className="max-w-md">{mismatch.description}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{mismatch.detectedAt}</TableCell>
                        <TableCell>
                          {mismatch.resolved ? (
                            <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline">Open</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-Chain Health Tab */}
        <TabsContent value="chains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Chain Health Heat Map</CardTitle>
              <CardDescription>Blockchain connector health metrics across multiple chains.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {chainHealth.map((chain) => (
                  <Card key={chain.chainId} className={getChainHealthColor(chain.health)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{chain.chainName}</CardTitle>
                        <StatusBadge status={chain.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Health Score</span>
                          <span className="text-sm font-semibold">{chain.health}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${chain.health >= 80 ? 'bg-emerald-600' : chain.health >= 60 ? 'bg-amber-600' : 'bg-rose-600'}`}
                            style={{ width: `${chain.health}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">TX/Hour</span>
                          <p className="font-semibold">{chain.transactionsPerHour}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Confirm</span>
                          <p className="font-semibold">{chain.averageConfirmationTime}s</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: 'healthy' | 'degraded' | 'error' }) {
  const config = {
    healthy: { label: 'Healthy', variant: 'default' as const, className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
    degraded: { label: 'Degraded', variant: 'default' as const, className: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
    error: { label: 'Error', variant: 'destructive' as const, className: 'bg-rose-100 text-rose-800', icon: AlertTriangle },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 w-fit ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: 'Low', className: 'bg-blue-100 text-blue-800' },
    medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800' },
    high: { label: 'High', className: 'bg-rose-100 text-rose-800' },
  }[severity]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

function getChainHealthColor(health: number): string {
  if (health >= 80) return 'border-emerald-200 bg-emerald-50'
  if (health >= 60) return 'border-amber-200 bg-amber-50'
  return 'border-rose-200 bg-rose-50'
}

function buildMockDataFlowMetrics(): DataFlowMetric[] {
  return [
    {
      source: 'TEFCA',
      eventsPerHour: 1247,
      averageLag: 2.3,
      errorRate: 0.15,
      lastEventTime: 'Just now',
      status: 'healthy',
    },
    {
      source: 'LICENSING_BOARD',
      eventsPerHour: 342,
      averageLag: 5.8,
      errorRate: 1.2,
      lastEventTime: '2 minutes ago',
      status: 'healthy',
    },
    {
      source: 'BLOCKCHAIN',
      eventsPerHour: 892,
      averageLag: 12.4,
      errorRate: 3.5,
      lastEventTime: '5 minutes ago',
      status: 'degraded',
    },
    {
      source: 'FHIR',
      eventsPerHour: 2156,
      averageLag: 1.8,
      errorRate: 0.08,
      lastEventTime: 'Just now',
      status: 'healthy',
    },
  ]
}

function buildMockComplianceMismatches(): ComplianceMismatch[] {
  return [
    {
      id: 'mismatch-1',
      source: 'TEFCA',
      severity: 'medium',
      description: 'POU (Purpose of Use) mismatch detected in FHIR bundle',
      detectedAt: '2 hours ago',
      resolved: false,
    },
    {
      id: 'mismatch-2',
      source: 'LICENSING_BOARD',
      severity: 'low',
      description: 'Credential expiration date format inconsistency',
      detectedAt: '1 day ago',
      resolved: true,
    },
    {
      id: 'mismatch-3',
      source: 'BLOCKCHAIN',
      severity: 'high',
      description: 'Transaction signature validation failure',
      detectedAt: '30 minutes ago',
      resolved: false,
    },
  ]
}

function buildMockChainHealth(): ChainHealth[] {
  return [
    {
      chainId: 'polygon-mainnet',
      chainName: 'Polygon Mainnet',
      health: 95,
      transactionsPerHour: 1247,
      averageConfirmationTime: 2.1,
      status: 'healthy',
    },
    {
      chainId: 'ethereum-mainnet',
      chainName: 'Ethereum Mainnet',
      health: 78,
      transactionsPerHour: 892,
      averageConfirmationTime: 15.3,
      status: 'healthy',
    },
    {
      chainId: 'polygon-testnet',
      chainName: 'Polygon Mumbai',
      health: 65,
      transactionsPerHour: 234,
      averageConfirmationTime: 8.7,
      status: 'degraded',
    },
    {
      chainId: 'avalanche-mainnet',
      chainName: 'Avalanche C-Chain',
      health: 88,
      transactionsPerHour: 567,
      averageConfirmationTime: 1.2,
      status: 'healthy',
    },
  ]
}


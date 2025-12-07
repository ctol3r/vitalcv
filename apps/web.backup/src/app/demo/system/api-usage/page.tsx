'use client'

/**
 * B235B-API-016: UsageAnalytics Dashboard
 *
 * Displays usage metrics (requests, quotas, error rates) per API key and organisation.
 * Includes charts and tables; supports custom date ranges and export.
 */

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Download,
  Key,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'

interface APIKeyUsage {
  id: string
  keyPrefix: string
  ownerOrgId: string
  scopes: string[]
  status: 'ACTIVE' | 'REVOKED'
  createdAt: string
  lastUsedAt?: string
  requestCount: number
  errorCount: number
  errorRate: number
  averageLatency: number
  dataTransfer: number
  quotaUsed: number
  quotaLimit: number
}

interface UsageDataPoint {
  timestamp: string
  requests: number
  errors: number
  latency: number
}

interface QuotaStatus {
  quotaType: string
  limit: number
  currentUsage: number
  remaining: number
  percentageUsed: number
  resetAt: string
  isExceeded: boolean
  isWarning: boolean
}

const MOCK_API_KEYS: APIKeyUsage[] = [
  {
    id: 'key_1',
    keyPrefix: 'sk_live_abc12345',
    ownerOrgId: 'org_1',
    scopes: ['read:credentials', 'read:organizations'],
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00Z',
    lastUsedAt: '2025-01-16T10:30:00Z',
    requestCount: 15420,
    errorCount: 45,
    errorRate: 0.0029,
    averageLatency: 125,
    dataTransfer: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
    quotaUsed: 15420,
    quotaLimit: 10000,
  },
  {
    id: 'key_2',
    keyPrefix: 'sk_live_def67890',
    ownerOrgId: 'org_1',
    scopes: ['read:modules', 'read:contracts'],
    status: 'ACTIVE',
    createdAt: '2025-01-05T00:00:00Z',
    lastUsedAt: '2025-01-16T09:15:00Z',
    requestCount: 8230,
    errorCount: 12,
    errorRate: 0.0015,
    averageLatency: 89,
    dataTransfer: 1.2 * 1024 * 1024 * 1024, // 1.2 GB
    quotaUsed: 8230,
    quotaLimit: 10000,
  },
  {
    id: 'key_3',
    keyPrefix: 'sk_live_ghi11111',
    ownerOrgId: 'org_2',
    scopes: ['read:credentials'],
    status: 'REVOKED',
    createdAt: '2024-12-01T00:00:00Z',
    lastUsedAt: '2025-01-10T14:20:00Z',
    requestCount: 3200,
    errorCount: 8,
    errorRate: 0.0025,
    averageLatency: 156,
    dataTransfer: 0.5 * 1024 * 1024 * 1024, // 0.5 GB
    quotaUsed: 3200,
    quotaLimit: 10000,
  },
]

const MOCK_USAGE_DATA: UsageDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const timestamp = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString()
  return {
    timestamp,
    requests: Math.floor(Math.random() * 2000) + 500,
    errors: Math.floor(Math.random() * 20),
    latency: Math.floor(Math.random() * 200) + 50,
  }
})

export default function APIUsagePage() {
  const [selectedKey, setSelectedKey] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const filteredKeys = useMemo(() => {
    if (selectedKey === 'all') return MOCK_API_KEYS
    return MOCK_API_KEYS.filter((k) => k.id === selectedKey)
  }, [selectedKey])

  const totalRequests = useMemo(
    () => filteredKeys.reduce((sum, k) => sum + k.requestCount, 0),
    [filteredKeys]
  )

  const totalErrors = useMemo(
    () => filteredKeys.reduce((sum, k) => sum + k.errorCount, 0),
    [filteredKeys]
  )

  const averageErrorRate = useMemo(() => {
    if (totalRequests === 0) return 0
    return totalErrors / totalRequests
  }, [totalRequests, totalErrors])

  const averageLatency = useMemo(() => {
    if (filteredKeys.length === 0) return 0
    const sum = filteredKeys.reduce((s, k) => s + k.averageLatency, 0)
    return Math.round(sum / filteredKeys.length)
  }, [filteredKeys])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleExport = () => {
    // TODO: Implement export functionality
    const csv = [
      ['API Key', 'Organization', 'Requests', 'Errors', 'Error Rate', 'Avg Latency', 'Data Transfer', 'Quota Used', 'Status'],
      ...filteredKeys.map((k) => [
        k.keyPrefix,
        k.ownerOrgId,
        k.requestCount.toString(),
        k.errorCount.toString(),
        (k.errorRate * 100).toFixed(2) + '%',
        k.averageLatency + 'ms',
        formatBytes(k.dataTransfer),
        k.quotaUsed + '/' + k.quotaLimit,
        k.status,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-usage-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Usage Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor API key usage, quotas, and performance metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 text-green-500" /> +12.5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(averageErrorRate * 100).toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              {averageErrorRate < 0.01 ? (
                <span className="text-green-500">Within acceptable range</span>
              ) : (
                <span className="text-yellow-500">Above threshold</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageLatency}ms</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 text-green-500" /> -5.2% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {MOCK_API_KEYS.filter((k) => k.status === 'ACTIVE').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {MOCK_API_KEYS.length} total API keys
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter usage data by API key and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select API key" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All API Keys</SelectItem>
                  {MOCK_API_KEYS.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {key.keyPrefix} ({key.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Usage</CardTitle>
          <CardDescription>Detailed usage metrics per API key</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API Key</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Error Rate</TableHead>
                <TableHead>Avg Latency</TableHead>
                <TableHead>Data Transfer</TableHead>
                <TableHead>Quota Usage</TableHead>
                <TableHead>Last Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                  <TableCell>{key.ownerOrgId}</TableCell>
                  <TableCell>
                    <Badge
                      variant={key.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {key.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{key.requestCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={cn(key.errorCount > 0 && 'text-red-500')}>
                      {key.errorCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        key.errorRate > 0.01 && 'text-yellow-500',
                        key.errorRate > 0.05 && 'text-red-500'
                      )}
                    >
                      {(key.errorRate * 100).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell>{key.averageLatency}ms</TableCell>
                  <TableCell>{formatBytes(key.dataTransfer)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            key.quotaUsed / key.quotaLimit > 0.9
                              ? 'bg-red-500'
                              : key.quotaUsed / key.quotaLimit > 0.8
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          )}
                          style={{
                            width: `${Math.min(100, (key.quotaUsed / key.quotaLimit) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {key.quotaUsed.toLocaleString()}/{key.quotaLimit.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Usage Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>Requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <BarChart3 className="h-12 w-12" />
              <p className="ml-2">Chart visualization (integrate with charting library)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate Trend</CardTitle>
            <CardDescription>Error rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <BarChart3 className="h-12 w-12" />
              <p className="ml-2">Chart visualization (integrate with charting library)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


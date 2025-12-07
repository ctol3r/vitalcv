/**
 * B238B-LIFE-020: LifecycleAnalyticsDashboard
 *
 * Dashboard for admins showing stats: number of expiring credentials, renewal success rates,
 * revocations per reason; charts and tables; date range filter.
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LifecycleStats {
  expiringCredentials: {
    total: number
    byType: Record<string, number>
    byOrg: Record<string, number>
  }
  renewalStats: {
    total: number
    successRate: number
    pending: number
    approved: number
    rejected: number
  }
  revocationStats: {
    total: number
    byReason: Record<string, number>
    byMonth: Record<string, number>
  }
}

export default function LifecycleAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [stats, setStats] = useState<LifecycleStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [dateRange])

  const loadStats = async () => {
    setLoading(true)
    try {
      // In a real implementation, this would fetch from an API
      // For now, using mock data
      const mockStats: LifecycleStats = {
        expiringCredentials: {
          total: 42,
          byType: {
            LICENSE: 15,
            BOARD_CERTIFICATION: 12,
            DEA: 8,
            PECOS: 5,
            MALPRACTICE_INSURANCE: 2,
          },
          byOrg: {
            'org-1': 20,
            'org-2': 15,
            'org-3': 7,
          },
        },
        renewalStats: {
          total: 128,
          successRate: 87.5,
          pending: 15,
          approved: 97,
          rejected: 16,
        },
        revocationStats: {
          total: 23,
          byReason: {
            EXPIRATION: 12,
            VOLUNTARY: 5,
            POLICY_VIOLATION: 4,
            PROFESSIONAL_MISCONDUCT: 2,
          },
          byMonth: {
            '2025-01': 5,
            '2025-02': 8,
            '2025-03': 10,
          },
        },
      }
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRangeLabel = (range: string) => {
    switch (range) {
      case '7d':
        return 'Last 7 days'
      case '30d':
        return 'Last 30 days'
      case '90d':
        return 'Last 90 days'
      case '1y':
        return 'Last year'
      default:
        return 'Last 30 days'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lifecycle Analytics</h1>
          <p className="text-muted-foreground">Credential lifecycle statistics and insights</p>
        </div>
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Credentials</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringCredentials.total}</div>
            <p className="text-xs text-muted-foreground">
              Credentials expiring in {getDateRangeLabel(dateRange)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Renewal Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.renewalStats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.renewalStats.approved} approved out of {stats.renewalStats.total} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revocations</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.revocationStats.total}</div>
            <p className="text-xs text-muted-foreground">
              Credentials revoked in {getDateRangeLabel(dateRange)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Credentials by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Expiring Credentials by Type</CardTitle>
          <CardDescription>Breakdown of expiring credentials by credential type</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credential Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.expiringCredentials.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const percentage =
                    (count / stats.expiringCredentials.total) * 100
                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">
                        {type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right">
                        {percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Renewal Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Renewal Status</CardTitle>
            <CardDescription>Current renewal request status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.renewalStats.approved}</span>
                  <Badge variant="secondary">
                    {((stats.renewalStats.approved / stats.renewalStats.total) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.renewalStats.pending}</span>
                  <Badge variant="secondary">
                    {((stats.renewalStats.pending / stats.renewalStats.total) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.renewalStats.rejected}</span>
                  <Badge variant="secondary">
                    {((stats.renewalStats.rejected / stats.renewalStats.total) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revocations by Reason</CardTitle>
            <CardDescription>Breakdown of revocations by reason</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(stats.revocationStats.byReason)
                  .sort(([, a], [, b]) => b - a)
                  .map(([reason, count]) => (
                    <TableRow key={reason}>
                      <TableCell className="font-medium">
                        {reason.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Revocations by Month */}
      <Card>
        <CardHeader>
          <CardTitle>Revocations Over Time</CardTitle>
          <CardDescription>Monthly revocation trends</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revocations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.revocationStats.byMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, count]) => (
                  <TableRow key={month}>
                    <TableCell className="font-medium">{month}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


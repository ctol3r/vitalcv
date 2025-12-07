'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Archive,
  Download,
  FileText,
  History,
  Settings,
  Shield,
  Upload,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DashboardStats {
  vaultSize: {
    total: string
    used: string
    percentage: number
  }
  recordCounts: {
    credentials: number
    logs: number
    contracts: number
    shares: number
  }
  recentExports: Array<{
    id: string
    format: string
    date: string
    status: 'completed' | 'processing' | 'failed'
  }>
  recentImports: Array<{
    id: string
    source: string
    date: string
    records: number
    status: 'completed' | 'processing' | 'failed'
  }>
  activeShares: Array<{
    id: string
    recipient: string
    scope: string
    expiresAt: string | null
  }>
  retentionPolicies: Array<{
    type: string
    period: string
    status: 'active' | 'pending'
  }>
}

export default function PrivacyDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const res = await fetch('/api/demo/privacy/dashboard')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || mockDashboardStats())
      } else {
        setStats(mockDashboardStats())
      }
    } catch (err) {
      setStats(mockDashboardStats())
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading privacy dashboard...</div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Unable to load dashboard data</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Privacy Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Overview of your personal vault, data sharing, and privacy settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/demo/privacy/history">
              <History className="w-4 h-4 mr-2" />
              View History
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/privacy">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Vault Size Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Vault</CardTitle>
          <CardDescription>Storage usage and capacity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Storage</p>
                <p className="text-2xl font-bold">{stats.vaultSize.total}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Used</p>
                <p className="text-2xl font-bold">{stats.vaultSize.used}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usage</p>
                <p className="text-2xl font-bold">{stats.vaultSize.percentage}%</p>
              </div>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${stats.vaultSize.percentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record Counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.recordCounts.credentials}</div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.recordCounts.logs}</div>
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.recordCounts.contracts}</div>
              <Archive className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Shares</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.recordCounts.shares}</div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Exports & Imports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Exports</CardTitle>
                <CardDescription>Data download history</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/demo/privacy/history?type=export">
                  <Activity className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentExports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No exports yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Format</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentExports.slice(0, 5).map((export_) => (
                    <TableRow key={export_.id}>
                      <TableCell className="font-medium">{export_.format}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(export_.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            export_.status === 'completed'
                              ? 'default'
                              : export_.status === 'processing'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {export_.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Imports</CardTitle>
                <CardDescription>Data import history</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/demo/privacy/history?type=import">
                  <Activity className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentImports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No imports yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentImports.slice(0, 5).map((import_) => (
                    <TableRow key={import_.id}>
                      <TableCell className="font-medium">{import_.source}</TableCell>
                      <TableCell>{import_.records}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(import_.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            import_.status === 'completed'
                              ? 'default'
                              : import_.status === 'processing'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {import_.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Shares */}
      <Card>
        <CardHeader>
          <CardTitle>Active Data Shares</CardTitle>
          <CardDescription>Currently shared data and access permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.activeShares.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active shares</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.activeShares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell className="font-medium">{share.recipient}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{share.scope}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
          <CardDescription>Configured data retention periods</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Type</TableHead>
                <TableHead>Retention Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.retentionPolicies.map((policy) => (
                <TableRow key={policy.type}>
                  <TableCell className="font-medium">{policy.type}</TableCell>
                  <TableCell>{policy.period}</TableCell>
                  <TableCell>
                    <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                      {policy.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/demo/privacy/settings?tab=retention">Configure</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common privacy operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/demo/privacy/download">
                <Download className="w-6 h-6 mb-2" />
                <span>Request Data Download</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/demo/privacy/import">
                <Upload className="w-6 h-6 mb-2" />
                <span>Import Data</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/audit">
                <FileText className="w-6 h-6 mb-2" />
                <span>View Audit Logs</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function mockDashboardStats(): DashboardStats {
  return {
    vaultSize: {
      total: '10 GB',
      used: '3.2 GB',
      percentage: 32,
    },
    recordCounts: {
      credentials: 45,
      logs: 1234,
      contracts: 12,
      shares: 3,
    },
    recentExports: [
      {
        id: 'exp-1',
        format: 'JSON',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
      },
      {
        id: 'exp-2',
        format: 'PDF',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
      },
      {
        id: 'exp-3',
        format: 'CSV',
        date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        status: 'processing',
      },
    ],
    recentImports: [
      {
        id: 'imp-1',
        source: 'External Vault',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        records: 23,
        status: 'completed',
      },
      {
        id: 'imp-2',
        source: 'Backup File',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        records: 12,
        status: 'completed',
      },
    ],
    activeShares: [
      {
        id: 'share-1',
        recipient: 'Healthcare Organization A',
        scope: 'Credentials Only',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'share-2',
        recipient: 'Research Institution B',
        scope: 'Anonymized Data',
        expiresAt: null,
      },
    ],
    retentionPolicies: [
      {
        type: 'Credentials',
        period: 'Indefinite',
        status: 'active',
      },
      {
        type: 'Audit Logs',
        period: '7 years',
        status: 'active',
      },
      {
        type: 'Contracts',
        period: '10 years',
        status: 'active',
      },
    ],
  }
}


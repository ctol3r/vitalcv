'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  Calendar,
  FileCheck,
  RefreshCw,
  Search,
  Eye,
  RotateCcw,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type CredentialStatus = 'expiring' | 'pending_renewal' | 'renewed' | 'expired'

type Credential = {
  id: string
  name: string
  type: 'board' | 'license' | 'certification' | 'privilege'
  expiryDate: string
  status: CredentialStatus
  daysUntilExpiry: number
  renewalRequestId?: string
  policyId?: string
}

// Mock data - replace with actual API call
const MOCK_CREDENTIALS: Credential[] = [
  {
    id: 'cred-1',
    name: 'ABMS Board Certification',
    type: 'board',
    expiryDate: '2025-06-15',
    status: 'expiring',
    daysUntilExpiry: 217,
    policyId: 'policy-1',
  },
  {
    id: 'cred-2',
    name: 'State Medical License',
    type: 'license',
    expiryDate: '2025-12-31',
    status: 'expiring',
    daysUntilExpiry: 416,
    policyId: 'policy-2',
  },
  {
    id: 'cred-3',
    name: 'DEA License',
    type: 'license',
    expiryDate: '2025-03-20',
    status: 'pending_renewal',
    daysUntilExpiry: 130,
    renewalRequestId: 'renewal-1',
    policyId: 'policy-3',
  },
  {
    id: 'cred-4',
    name: 'ACLS Certification',
    type: 'certification',
    expiryDate: '2025-01-10',
    status: 'renewed',
    daysUntilExpiry: -5,
    renewalRequestId: 'renewal-2',
    policyId: 'policy-4',
  },
  {
    id: 'cred-5',
    name: 'Procedural Sedation Privilege',
    type: 'privilege',
    expiryDate: '2025-09-01',
    status: 'expiring',
    daysUntilExpiry: 305,
    policyId: 'policy-5',
  },
]

export default function ExpiringCredentialsDashboard() {
  const [credentials, setCredentials] = useState<Credential[]>(MOCK_CREDENTIALS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CredentialStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch = cred.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || cred.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleRenew = async (credentialId: string) => {
    // Navigate to renewal form
    window.location.href = `/demo/lifecycle/renewals/new?credentialId=${credentialId}`
  }

  const handleViewPolicy = (policyId: string) => {
    // Navigate to policy view
    window.location.href = `/admin/lifecycle/policies?policyId=${policyId}`
  }

  const handleRefresh = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLoading(false)
  }

  const getStatusBadge = (status: CredentialStatus) => {
    const config = {
      expiring: {
        label: 'Expiring',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
        icon: Clock,
      },
      pending_renewal: {
        label: 'Pending Renewal',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
        icon: RefreshCw,
      },
      renewed: {
        label: 'Renewed',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: CheckCircle2,
      },
      expired: {
        label: 'Expired',
        className: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: XCircle,
      },
    }

    const { label, className, icon: Icon } = config[status]
    return (
      <Badge variant="outline" className={cn('text-xs flex items-center gap-1', className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const getTypeIcon = (type: Credential['type']) => {
    switch (type) {
      case 'board':
        return Award
      case 'license':
        return FileCheck
      case 'certification':
        return Award
      case 'privilege':
        return FileCheck
    }
  }

  const getUrgencyColor = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) return 'text-rose-600'
    if (daysUntilExpiry < 30) return 'text-rose-500'
    if (daysUntilExpiry < 90) return 'text-amber-600'
    if (daysUntilExpiry < 180) return 'text-amber-500'
    return 'text-slate-600'
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Lifecycle • Dashboard</p>
        <h1 className="text-3xl font-bold tracking-tight">Expiring Credentials Dashboard</h1>
        <p className="text-muted-foreground max-w-3xl">
          View and manage your credentials with expiry dates, renewal status, and take action on expiring credentials.
        </p>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credentials.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {credentials.filter((c) => c.status === 'expiring' && c.daysUntilExpiry < 90).length}
            </div>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Renewal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">
              {credentials.filter((c) => c.status === 'pending_renewal').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recently Renewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {credentials.filter((c) => c.status === 'renewed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Manage your expiring credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search credentials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg border p-1">
                {(['all', 'expiring', 'pending_renewal', 'renewed'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="text-xs"
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Credentials Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credential</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Days Until Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCredentials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No credentials found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCredentials.map((credential) => {
                    const TypeIcon = getTypeIcon(credential.type)
                    const isUrgent = credential.daysUntilExpiry >= 0 && credential.daysUntilExpiry < 90

                    return (
                      <TableRow key={credential.id} className={cn(isUrgent && 'bg-amber-50/30')}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{credential.name}</div>
                              {credential.renewalRequestId && (
                                <div className="text-xs text-muted-foreground">
                                  Renewal: {credential.renewalRequestId}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {credential.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {new Date(credential.expiryDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('font-medium', getUrgencyColor(credential.daysUntilExpiry))}>
                            {credential.daysUntilExpiry < 0
                              ? `${Math.abs(credential.daysUntilExpiry)} days ago`
                              : `${credential.daysUntilExpiry} days`}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(credential.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {credential.status === 'expiring' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRenew(credential.id)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Renew
                              </Button>
                            )}
                            {credential.policyId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPolicy(credential.policyId!)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Policy
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


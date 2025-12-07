'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type RenewalStatus = 'pending' | 'approved' | 'denied'

type RenewalRequest = {
  id: string
  credentialId: string
  credentialName: string
  holderName: string
  submittedAt: string
  status: RenewalStatus
  reason: string
}

// Mock data - replace with actual API call
const MOCK_RENEWALS: RenewalRequest[] = [
  {
    id: 'renewal-1',
    credentialId: 'cred-1',
    credentialName: 'State Medical License',
    holderName: 'Dr. John Smith',
    submittedAt: '2025-01-15T10:30:00Z',
    status: 'pending',
    reason: 'License renewal required',
  },
  {
    id: 'renewal-2',
    credentialId: 'cred-2',
    credentialName: 'DEA License',
    holderName: 'Dr. Jane Doe',
    submittedAt: '2025-01-14T14:20:00Z',
    status: 'pending',
    reason: 'DEA registration renewal',
  },
  {
    id: 'renewal-3',
    credentialId: 'cred-3',
    credentialName: 'Board Certification',
    holderName: 'Dr. Bob Johnson',
    submittedAt: '2025-01-13T09:15:00Z',
    status: 'approved',
    reason: 'Board certification maintenance',
  },
  {
    id: 'renewal-4',
    credentialId: 'cred-4',
    credentialName: 'ACLS Certification',
    holderName: 'Dr. Alice Williams',
    submittedAt: '2025-01-12T16:45:00Z',
    status: 'denied',
    reason: 'ACLS recertification',
  },
]

export default function BatchRenewalProcessingPage() {
  const [renewals, setRenewals] = useState<RenewalRequest[]>(MOCK_RENEWALS)
  const [selectedRenewals, setSelectedRenewals] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RenewalStatus | 'all'>('all')

  const filteredRenewals = renewals.filter((renewal) => {
    const matchesSearch =
      renewal.credentialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      renewal.holderName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || renewal.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const toggleSelectAll = () => {
    if (selectedRenewals.size === filteredRenewals.length) {
      setSelectedRenewals(new Set())
    } else {
      setSelectedRenewals(new Set(filteredRenewals.map((r) => r.id)))
    }
  }

  const toggleSelect = (renewalId: string) => {
    const newSelected = new Set(selectedRenewals)
    if (newSelected.has(renewalId)) {
      newSelected.delete(renewalId)
    } else {
      newSelected.add(renewalId)
    }
    setSelectedRenewals(newSelected)
  }

  const handleBulkApprove = async () => {
    if (selectedRenewals.size === 0) return

    if (confirm(`Approve ${selectedRenewals.size} renewal request(s)?`)) {
      try {
        const response = await fetch('/api/admin/lifecycle/renewals/batch-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renewalIds: Array.from(selectedRenewals) }),
        })

        if (response.ok) {
          setRenewals((prev) =>
            prev.map((r) =>
              selectedRenewals.has(r.id) ? { ...r, status: 'approved' as RenewalStatus } : r,
            ),
          )
          setSelectedRenewals(new Set())
        }
      } catch (error) {
        console.error('Failed to approve renewals:', error)
      }
    }
  }

  const handleBulkDeny = async () => {
    if (selectedRenewals.size === 0) return

    if (confirm(`Deny ${selectedRenewals.size} renewal request(s)?`)) {
      try {
        const response = await fetch('/api/admin/lifecycle/renewals/batch-deny', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renewalIds: Array.from(selectedRenewals) }),
        })

        if (response.ok) {
          setRenewals((prev) =>
            prev.map((r) =>
              selectedRenewals.has(r.id) ? { ...r, status: 'denied' as RenewalStatus } : r,
            ),
          )
          setSelectedRenewals(new Set())
        }
      } catch (error) {
        console.error('Failed to deny renewals:', error)
      }
    }
  }

  const handleExport = () => {
    const data = filteredRenewals.map((r) => ({
      ID: r.id,
      Credential: r.credentialName,
      Holder: r.holderName,
      Status: r.status,
      Submitted: r.submittedAt,
      Reason: r.reason,
    }))

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `renewals-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getStatusBadge = (status: RenewalStatus) => {
    const configs = {
      pending: {
        label: 'Pending',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
        icon: RefreshCw,
      },
      approved: {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: CheckCircle2,
      },
      denied: {
        label: 'Denied',
        className: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: XCircle,
      },
    }

    const config = configs[status]
    const Icon = config.icon

    return (
      <Badge variant="outline" className={cn('text-xs flex items-center gap-1', config.className)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const pendingCount = renewals.filter((r) => r.status === 'pending').length
  const selectedPendingCount = Array.from(selectedRenewals).filter((id) => {
    const renewal = renewals.find((r) => r.id === id)
    return renewal?.status === 'pending'
  }).length

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Admin • Lifecycle • Batch Renewals
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Batch Renewal Processing</h1>
            <p className="text-muted-foreground max-w-3xl">
              Process multiple renewal requests at once. Approve, deny, or export renewal data.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{renewals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{selectedRenewals.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Renewal Requests</CardTitle>
          <CardDescription>Review and process renewal requests in bulk</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search renewals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg border p-1">
                {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="text-xs"
                  >
                    {status === 'all' ? 'All' : status}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedRenewals.size > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-medium">
                {selectedRenewals.size} renewal{selectedRenewals.size !== 1 ? 's' : ''} selected
                {selectedPendingCount > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({selectedPendingCount} pending)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={selectedPendingCount === 0}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeny}
                  disabled={selectedPendingCount === 0}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny Selected
                </Button>
              </div>
            </div>
          )}

          {/* Renewals Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredRenewals.length > 0 &&
                        selectedRenewals.size === filteredRenewals.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRenewals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No renewal requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRenewals.map((renewal) => (
                    <TableRow key={renewal.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRenewals.has(renewal.id)}
                          onCheckedChange={() => toggleSelect(renewal.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{renewal.credentialName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {renewal.credentialId}
                        </div>
                      </TableCell>
                      <TableCell>{renewal.holderName}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">{renewal.reason}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(renewal.submittedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(renewal.submittedAt).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(renewal.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <FileText className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


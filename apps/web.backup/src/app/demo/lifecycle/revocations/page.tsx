'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search,
  Filter,
  Ban,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type RevocationStatus = 'pending' | 'active' | 'completed' | 'cancelled'

type Revocation = {
  id: string
  credentialId: string
  credentialName: string
  holderName: string
  reason: string
  status: RevocationStatus
  initiatedBy: string
  initiatedAt: string
  effectiveDate?: string
  completedAt?: string
}

// Mock data - replace with actual API call
const MOCK_REVOCATIONS: Revocation[] = [
  {
    id: 'rev-1',
    credentialId: 'cred-1',
    credentialName: 'State Medical License',
    holderName: 'Dr. John Smith',
    reason: 'License suspension by state board',
    status: 'active',
    initiatedBy: 'Admin User',
    initiatedAt: '2025-01-10T09:00:00Z',
    effectiveDate: '2025-01-10T09:00:00Z',
  },
  {
    id: 'rev-2',
    credentialId: 'cred-2',
    credentialName: 'DEA License',
    holderName: 'Dr. Jane Doe',
    reason: 'DEA registration revoked',
    status: 'pending',
    initiatedBy: 'Admin User',
    initiatedAt: '2025-01-15T14:30:00Z',
  },
  {
    id: 'rev-3',
    credentialId: 'cred-3',
    credentialName: 'Board Certification',
    holderName: 'Dr. Bob Johnson',
    reason: 'Professional misconduct',
    status: 'completed',
    initiatedBy: 'Admin User',
    initiatedAt: '2024-12-01T10:00:00Z',
    effectiveDate: '2024-12-01T10:00:00Z',
    completedAt: '2024-12-01T10:05:00Z',
  },
]

export default function RevocationManagementPage() {
  const [revocations, setRevocations] = useState<Revocation[]>(MOCK_REVOCATIONS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RevocationStatus | 'all'>('all')
  const [showNewRevocationDialog, setShowNewRevocationDialog] = useState(false)
  const [selectedRevocation, setSelectedRevocation] = useState<Revocation | null>(null)
  const [newRevocation, setNewRevocation] = useState({
    credentialId: '',
    reason: '',
  })

  const filteredRevocations = revocations.filter((rev) => {
    const matchesSearch =
      rev.credentialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rev.holderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rev.reason.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || rev.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleInitiateRevocation = async () => {
    if (!newRevocation.credentialId || !newRevocation.reason) {
      return
    }

    // Call RevocationService
    try {
      const response = await fetch('/api/demo/lifecycle/revocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRevocation),
      })

      if (response.ok) {
        const newRev = await response.json()
        setRevocations([newRev, ...revocations])
        setShowNewRevocationDialog(false)
        setNewRevocation({ credentialId: '', reason: '' })
      }
    } catch (error) {
      console.error('Failed to initiate revocation:', error)
    }
  }

  const handleInitiateFreeze = async (credentialId: string) => {
    if (confirm('Are you sure you want to freeze this credential?')) {
      try {
        const response = await fetch(`/api/demo/lifecycle/credentials/${credentialId}/freeze`, {
          method: 'POST',
        })

        if (response.ok) {
          // Refresh revocations list
          window.location.reload()
        }
      } catch (error) {
        console.error('Failed to freeze credential:', error)
      }
    }
  }

  const getStatusBadge = (status: RevocationStatus) => {
    const configs = {
      pending: {
        label: 'Pending',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
        icon: Clock,
      },
      active: {
        label: 'Active',
        className: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: AlertCircle,
      },
      completed: {
        label: 'Completed',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: CheckCircle2,
      },
      cancelled: {
        label: 'Cancelled',
        className: 'bg-slate-50 text-slate-900 border-slate-200',
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

  const activeCount = revocations.filter((r) => r.status === 'active').length
  const pendingCount = revocations.filter((r) => r.status === 'pending').length

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Demo • Lifecycle • Revocations
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revocation Management</h1>
            <p className="text-muted-foreground max-w-3xl">
              Manage credential revocations and freezes. Initiate new revocations or view existing
              ones.
            </p>
          </div>
          <Button onClick={() => setShowNewRevocationDialog(true)}>
            <Ban className="h-4 w-4 mr-2" />
            Initiate Revocation
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revocations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Revocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{activeCount}</div>
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
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Revocations</CardTitle>
          <CardDescription>Active and pending credential revocations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search revocations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg border p-1">
                {(['all', 'pending', 'active', 'completed'] as const).map((status) => (
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

          {/* Revocations Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credential</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRevocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No revocations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRevocations.map((revocation) => (
                    <TableRow key={revocation.id}>
                      <TableCell>
                        <div className="font-medium">{revocation.credentialName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {revocation.credentialId}
                        </div>
                      </TableCell>
                      <TableCell>{revocation.holderName}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">{revocation.reason}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(revocation.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(revocation.initiatedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          by {revocation.initiatedBy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInitiateFreeze(revocation.credentialId)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Freeze
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRevocation(revocation)}
                          >
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

      {/* New Revocation Dialog */}
      <AlertDialog open={showNewRevocationDialog} onOpenChange={setShowNewRevocationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initiate New Revocation</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke or freeze a credential. This action will be logged and may require
              additional approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credentialId">Credential ID *</Label>
              <Input
                id="credentialId"
                value={newRevocation.credentialId}
                onChange={(e) =>
                  setNewRevocation({ ...newRevocation, credentialId: e.target.value })
                }
                placeholder="Enter credential ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={newRevocation.reason}
                onChange={(e) => setNewRevocation({ ...newRevocation, reason: e.target.value })}
                placeholder="Enter reason for revocation..."
                rows={4}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInitiateRevocation}>Initiate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


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
  Plus,
  Edit,
  Trash2,
  Search,
  Settings,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type PolicyType = 'expiry' | 'renewal' | 'auto_renewal'

type RenewalPolicy = {
  id: string
  name: string
  type: PolicyType
  credentialType: string
  expiryWarningDays: number
  autoRenewalEnabled: boolean
  requiresApproval: boolean
  pendingApprovals: number
  createdAt: string
  updatedAt: string
}

// Mock data - replace with actual API call
const MOCK_POLICIES: RenewalPolicy[] = [
  {
    id: 'policy-1',
    name: 'Medical License Renewal Policy',
    type: 'renewal',
    credentialType: 'license',
    expiryWarningDays: 90,
    autoRenewalEnabled: false,
    requiresApproval: true,
    pendingApprovals: 3,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-12-01T14:30:00Z',
  },
  {
    id: 'policy-2',
    name: 'Board Certification Auto-Renewal',
    type: 'auto_renewal',
    credentialType: 'board',
    expiryWarningDays: 180,
    autoRenewalEnabled: true,
    requiresApproval: false,
    pendingApprovals: 0,
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-11-15T11:00:00Z',
  },
  {
    id: 'policy-3',
    name: 'DEA License Expiry Policy',
    type: 'expiry',
    credentialType: 'license',
    expiryWarningDays: 60,
    autoRenewalEnabled: false,
    requiresApproval: true,
    pendingApprovals: 1,
    createdAt: '2024-03-10T08:00:00Z',
    updatedAt: '2024-12-10T16:00:00Z',
  },
]

export default function AdminPolicyDashboard() {
  const [policies, setPolicies] = useState<RenewalPolicy[]>(MOCK_POLICIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<PolicyType | 'all'>('all')

  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch = policy.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || policy.type === typeFilter
    return matchesSearch && matchesType
  })

  const handleAddPolicy = () => {
    // Navigate to add policy page
    window.location.href = '/admin/lifecycle/policies/new'
  }

  const handleEditPolicy = (policyId: string) => {
    window.location.href = `/admin/lifecycle/policies/${policyId}/edit`
  }

  const handleDeletePolicy = async (policyId: string) => {
    if (confirm('Are you sure you want to delete this policy?')) {
      try {
        const response = await fetch(`/api/admin/lifecycle/policies/${policyId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setPolicies(policies.filter((p) => p.id !== policyId))
        }
      } catch (error) {
        console.error('Failed to delete policy:', error)
      }
    }
  }

  const getTypeBadge = (type: PolicyType) => {
    const configs = {
      expiry: {
        label: 'Expiry',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
      },
      renewal: {
        label: 'Renewal',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
      },
      auto_renewal: {
        label: 'Auto-Renewal',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      },
    }

    const config = configs[type]
    return (
      <Badge variant="outline" className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    )
  }

  const totalPendingApprovals = policies.reduce((sum, p) => sum + p.pendingApprovals, 0)

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Admin • Lifecycle • Policies
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lifecycle Policy Dashboard</h1>
            <p className="text-muted-foreground max-w-3xl">
              Manage expiry and renewal policies, auto-renewal rules, and pending approvals
            </p>
          </div>
          <Button onClick={handleAddPolicy}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalPendingApprovals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Auto-Renewal Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {policies.filter((p) => p.autoRenewalEnabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Requires Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">
              {policies.filter((p) => p.requiresApproval).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
          <CardDescription>Expiry and renewal policies overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 rounded-lg border p-1">
              {(['all', 'expiry', 'renewal', 'auto_renewal'] as const).map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                  className="text-xs"
                >
                  {type === 'all' ? 'All' : type.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Credential Type</TableHead>
                  <TableHead>Warning Days</TableHead>
                  <TableHead>Auto-Renewal</TableHead>
                  <TableHead>Approval Required</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No policies found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="font-medium">{policy.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Updated {new Date(policy.updatedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(policy.type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {policy.credentialType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {policy.expiryWarningDays} days
                        </div>
                      </TableCell>
                      <TableCell>
                        {policy.autoRenewalEnabled ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.requiresApproval ? (
                          <Badge variant="outline" className="bg-sky-50 text-sky-900 border-sky-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Required
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.pendingApprovals > 0 ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                            {policy.pendingApprovals}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPolicy(policy.id)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePolicy(policy.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
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


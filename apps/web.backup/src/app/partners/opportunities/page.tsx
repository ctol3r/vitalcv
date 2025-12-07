'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  User,
  Edit,
  MoreVertical,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Opportunity {
  id: string
  title: string
  description?: string
  status: 'new' | 'in_progress' | 'won' | 'lost'
  potentialValue?: number
  assignedTo?: string
  assignedToName?: string
  createdAt: string
  updatedAt: string
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    potentialValue: '',
    assignedTo: '',
  })

  useEffect(() => {
    loadOpportunities()
  }, [])

  useEffect(() => {
    filterOpportunities()
  }, [opportunities, searchQuery, statusFilter, dateFilter])

  async function loadOpportunities() {
    try {
      const response = await fetch('/api/partners/opportunities')
      if (!response.ok) throw new Error('Failed to load opportunities')
      const data = await response.json()
      setOpportunities(data.opportunities || [])
    } catch (err) {
      console.error('Failed to load opportunities:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterOpportunities() {
    let filtered = [...opportunities]

    if (searchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      filtered = filtered.filter((o) => {
        const created = new Date(o.createdAt)
        switch (dateFilter) {
          case 'today':
            return created.toDateString() === now.toDateString()
          case 'week':
            return created.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
          case 'month':
            return created.getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000
          default:
            return true
        }
      })
    }

    setFilteredOpportunities(filtered)
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/partners/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          potentialValue: formData.potentialValue ? parseInt(formData.potentialValue) * 100 : undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to create opportunity')

      setShowCreateDialog(false)
      setFormData({ title: '', description: '', potentialValue: '', assignedTo: '' })
      await loadOpportunities()
    } catch (err) {
      console.error('Failed to create opportunity:', err)
      alert('Failed to create opportunity. Please try again.')
    }
  }

  async function handleUpdateStatus(opportunityId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/partners/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update opportunity')

      await loadOpportunities()
    } catch (err) {
      console.error('Failed to update opportunity:', err)
      alert('Failed to update opportunity. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'secondary',
      in_progress: 'default',
      won: 'default',
      lost: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>
  }

  const formatCurrency = (cents?: number) => {
    if (!cents) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Opportunity Management</h1>
          <p className="text-muted-foreground">
            Create and manage partnership opportunities
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Opportunity</DialogTitle>
              <DialogDescription>
                Add a new partnership opportunity to track
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Enterprise Partnership with Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the partnership opportunity..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="potentialValue">Potential Value ($)</Label>
                  <Input
                    id="potentialValue"
                    type="number"
                    value={formData.potentialValue}
                    onChange={(e) => setFormData({ ...formData, potentialValue: e.target.value })}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <Input
                    id="assignedTo"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    placeholder="User ID or email"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.title.trim()}>
                Create Opportunity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunities</CardTitle>
          <CardDescription>
            {filteredOpportunities.length} opportunity{filteredOpportunities.length !== 1 ? 'ies' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading opportunities...</div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No opportunities found. Create your first opportunity to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Potential Value</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{opportunity.title}</div>
                        {opportunity.description && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {opportunity.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={opportunity.status}
                        onValueChange={(value) => handleUpdateStatus(opportunity.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          {getStatusBadge(opportunity.status)}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatCurrency(opportunity.potentialValue)}</TableCell>
                    <TableCell>
                      {opportunity.assignedToName || opportunity.assignedTo || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      {new Date(opportunity.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/partners/proposals?opportunityId=${opportunity.id}`}>
                            View Proposals
                          </Link>
                        </Button>
                      </div>
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


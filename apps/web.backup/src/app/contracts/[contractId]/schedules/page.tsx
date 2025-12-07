'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type MilestoneStatus = 'PENDING' | 'COMPLETED'

interface Contract {
  id: string
  title: string
  schedules: ContractSchedule[]
}

interface ContractSchedule {
  id: string
  milestoneName: string
  dueDate: string
  status: MilestoneStatus
  completedAt: string | null
  createdAt: string
}

export default function ContractSchedulesPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.contractId as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    milestoneName: '',
    dueDate: '',
  })

  useEffect(() => {
    if (contractId) {
      loadContract()
    }
  }, [contractId])

  async function loadContract() {
    try {
      setLoading(true)
      const response = await fetch(`/api/contracts/${contractId}/schedules`)
      if (!response.ok) {
        throw new Error(`Failed to load schedules (${response.status})`)
      }
      const data = await response.json()
      setContract({
        id: contractId,
        title: data.contract?.title || 'Contract',
        schedules: data.schedules || [],
      })
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load schedules')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      milestoneName: '',
      dueDate: '',
    })
  }

  function openAddDialog() {
    resetForm()
    setShowAddDialog(true)
  }

  async function createMilestone() {
    try {
      if (!formData.milestoneName || !formData.dueDate) {
        setError('Milestone name and due date are required')
        return
      }
      const response = await fetch(`/api/contracts/${contractId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneName: formData.milestoneName,
          dueDate: formData.dueDate,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to create milestone')
      }
      setShowAddDialog(false)
      resetForm()
      loadContract()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create milestone')
    }
  }

  async function completeMilestone(scheduleId: string) {
    try {
      const response = await fetch(`/api/contracts/${contractId}/schedules/${scheduleId}/complete`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to mark milestone as complete')
      }
      loadContract()
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark milestone as complete')
    }
  }

  function getStatusBadge(status: MilestoneStatus, dueDate: string) {
    const isOverdue = new Date(dueDate) < new Date() && status === 'PENDING'
    if (status === 'COMPLETED') {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      )
    }
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    )
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString()
  }

  const pendingSchedules = contract?.schedules.filter(s => s.status === 'PENDING') || []
  const completedSchedules = contract?.schedules.filter(s => s.status === 'COMPLETED') || []
  const overdueSchedules = pendingSchedules.filter(s => new Date(s.dueDate) < new Date())

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading schedules…</div>
      </div>
    )
  }

  if (error && !contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/contracts/${contractId}`)}>
              Back to Contract
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/contracts/${contractId}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Contract
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Schedules</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-7 w-7 text-primary" aria-hidden="true" />
              Contract Schedules
            </h1>
            {contract && (
              <p className="text-muted-foreground mt-2">{contract.title}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Milestone
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contract?.schedules.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSchedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueSchedules.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Milestones & Deliverables</CardTitle>
          <CardDescription>
            Track contract milestones, deliverables, and due dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract?.schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.milestoneName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(schedule.dueDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(schedule.status, schedule.dueDate)}
                  </TableCell>
                  <TableCell>
                    {schedule.completedAt ? formatDate(schedule.completedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    {schedule.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => completeMilestone(schedule.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {contract && contract.schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No milestones created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Milestone</DialogTitle>
            <DialogDescription>
              Add a new milestone or deliverable to track
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="milestoneName">Milestone Name</Label>
              <Input
                id="milestoneName"
                value={formData.milestoneName}
                onChange={(e) => setFormData({ ...formData, milestoneName: e.target.value })}
                placeholder="e.g., Initial Payment, Deliverable 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createMilestone}>Create Milestone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


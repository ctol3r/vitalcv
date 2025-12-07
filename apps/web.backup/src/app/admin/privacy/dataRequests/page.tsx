'use client'

import { useState, useEffect } from 'react'
import { Shield, Clock, CheckCircle2, X, Mail, AlertTriangle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type RequestType = 'access' | 'deletion' | 'correction'
type RequestStatus = 'pending' | 'in-progress' | 'completed' | 'rejected' | 'cancelled'

interface DataRequest {
  id: string
  type: RequestType
  userId: string
  userEmail: string
  userName: string
  description: string
  submittedAt: string
  deadline: string
  status: RequestStatus
  assignedTo?: string
  notes?: string
  completedAt?: string
}

export default function AdminDataRequestPortalPage() {
  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('pending')
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionNotes, setActionNotes] = useState('')

  useEffect(() => {
    loadRequests()
  }, [statusFilter])

  async function loadRequests() {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/admin/privacy/dataRequests?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || mockDataRequests())
      } else {
        setRequests(mockDataRequests())
      }
    } catch (err) {
      setRequests(mockDataRequests())
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(request: DataRequest, newStatus: RequestStatus) {
    setSelectedRequest(request)
    setActionNotes('')
    setShowActionDialog(true)
  }

  async function confirmAction() {
    if (!selectedRequest) return

    try {
      const res = await fetch(`/api/admin/privacy/dataRequests/${selectedRequest.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedRequest.status === 'pending' ? 'in-progress' : 'completed',
          notes: actionNotes,
        }),
      })

      if (res.ok) {
        await loadRequests()
        setShowActionDialog(false)
        setSelectedRequest(null)
        setActionNotes('')
      }
    } catch (err) {
      console.error('Failed to update request', err)
    }
  }

  function getDaysUntilDeadline(deadline: string): number {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const diffMs = deadlineDate.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  function getRequestTypeLabel(type: RequestType): string {
    const labels: Record<RequestType, string> = {
      access: 'Data Access',
      deletion: 'Data Deletion',
      correction: 'Data Correction',
    }
    return labels[type]
  }

  function getRequestTypeColor(type: RequestType): 'default' | 'secondary' | 'destructive' {
    const colors: Record<RequestType, 'default' | 'secondary' | 'destructive'> = {
      access: 'default',
      deletion: 'destructive',
      correction: 'secondary',
    }
    return colors[type]
  }

  const filteredRequests = requests.filter(
    (req) => statusFilter === 'all' || req.status === statusFilter
  )

  const pendingRequests = requests.filter((req) => req.status === 'pending')
  const overdueRequests = requests.filter(
    (req) => req.status !== 'completed' && getDaysUntilDeadline(req.deadline) < 0
  )

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading data requests...</div>
        </div>
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
            Data Request Portal
          </h1>
          <p className="text-gray-600 mt-1">
            Handle data access, deletion, and correction requests from users
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{pendingRequests.length} Pending</Badge>
          {overdueRequests.length > 0 && (
            <Badge variant="destructive">{overdueRequests.length} Overdue</Badge>
          )}
        </div>
      </div>

      {/* Alerts */}
      {overdueRequests.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> {overdueRequests.length} request(s) have passed their deadline.
            Please process them immediately.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as RequestStatus | 'all')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Requests</CardTitle>
          <CardDescription>{filteredRequests.length} request(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const daysUntilDeadline = getDaysUntilDeadline(request.deadline)
                  const isOverdue = daysUntilDeadline < 0 && request.status !== 'completed'
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">{request.id}</TableCell>
                      <TableCell>
                        <Badge variant={getRequestTypeColor(request.type)}>
                          {getRequestTypeLabel(request.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.userName}</div>
                          <div className="text-sm text-muted-foreground">{request.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(request.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{new Date(request.deadline).toLocaleDateString()}</div>
                            {isOverdue ? (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Overdue
                              </Badge>
                            ) : daysUntilDeadline <= 7 ? (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {daysUntilDeadline} days left
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === 'completed'
                              ? 'default'
                              : request.status === 'pending'
                                ? 'secondary'
                                : request.status === 'in-progress'
                                  ? 'default'
                                  : 'destructive'
                          }
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {request.status === 'pending' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleStatusChange(request, 'in-progress')}
                            >
                              Start Processing
                            </Button>
                          )}
                          {request.status === 'in-progress' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleStatusChange(request, 'completed')}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Request ID</Label>
                <div className="font-mono text-sm">{selectedRequest.id}</div>
              </div>
              <div>
                <Label>Type</Label>
                <div>
                  <Badge variant={getRequestTypeColor(selectedRequest.type)}>
                    {getRequestTypeLabel(selectedRequest.type)}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>User</Label>
                <div>
                  <div className="font-medium">{selectedRequest.userName}</div>
                  <div className="text-sm text-muted-foreground">{selectedRequest.userEmail}</div>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div>
                  <Badge>{selectedRequest.status}</Badge>
                </div>
              </div>
              <div>
                <Label>Submitted</Label>
                <div>{new Date(selectedRequest.submittedAt).toLocaleString()}</div>
              </div>
              <div>
                <Label>Deadline</Label>
                <div>
                  {new Date(selectedRequest.deadline).toLocaleString()}
                  {getDaysUntilDeadline(selectedRequest.deadline) < 0 && (
                    <Badge variant="destructive" className="ml-2">
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <div className="p-3 bg-muted rounded-md">{selectedRequest.description}</div>
            </div>
            {selectedRequest.notes && (
              <div>
                <Label>Notes</Label>
                <div className="p-3 bg-muted rounded-md">{selectedRequest.notes}</div>
              </div>
            )}
            {selectedRequest.assignedTo && (
              <div>
                <Label>Assigned To</Label>
                <div>{selectedRequest.assignedTo}</div>
              </div>
            )}
            {selectedRequest.completedAt && (
              <div>
                <Label>Completed At</Label>
                <div>{new Date(selectedRequest.completedAt).toLocaleString()}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedRequest?.status === 'pending' ? 'Start Processing Request' : 'Complete Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest?.status === 'pending'
                ? 'This will mark the request as in progress and notify the requester.'
                : 'This will mark the request as completed and notify the requester.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this action..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {selectedRequest?.status === 'pending' ? 'Start Processing' : 'Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function mockDataRequests(): DataRequest[] {
  return [
    {
      id: 'REQ-2024-001',
      type: 'access',
      userId: 'user-123',
      userEmail: 'user@example.com',
      userName: 'John Doe',
      description: 'Requesting access to all personal data stored in the system',
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: 'REQ-2024-002',
      type: 'deletion',
      userId: 'user-456',
      userEmail: 'jane@example.com',
      userName: 'Jane Smith',
      description: 'Requesting complete deletion of all personal data',
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'in-progress',
      assignedTo: 'Admin User',
      notes: 'Verifying identity and checking retention obligations',
    },
    {
      id: 'REQ-2024-003',
      type: 'correction',
      userId: 'user-789',
      userEmail: 'bob@example.com',
      userName: 'Bob Johnson',
      description: 'Requesting correction of incorrect email address',
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      deadline: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      assignedTo: 'Admin User',
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Email address corrected and user notified',
    },
  ]
}


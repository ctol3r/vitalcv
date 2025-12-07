'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  Database,
  Download,
  RefreshCw,
  RotateCcw,
  Shield,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

interface Backup {
  id: string
  name: string
  type: 'full' | 'incremental'
  status: 'completed' | 'in-progress' | 'failed'
  size: string
  createdAt: string
  completedAt?: string
  retentionDays: number
  location: string
}

interface RestoreOperation {
  id: string
  backupId: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  targetEnvironment: string
}

const MOCK_BACKUPS: Backup[] = [
  {
    id: 'backup-1',
    name: 'Full Backup - 2025-11-16',
    type: 'full',
    status: 'completed',
    size: '2.4 TB',
    createdAt: '2025-11-16T00:00:00Z',
    completedAt: '2025-11-16T02:30:00Z',
    retentionDays: 30,
    location: 's3://backups/production/full/2025-11-16',
  },
  {
    id: 'backup-2',
    name: 'Incremental Backup - 2025-11-16',
    type: 'incremental',
    status: 'completed',
    size: '145 GB',
    createdAt: '2025-11-16T12:00:00Z',
    completedAt: '2025-11-16T12:15:00Z',
    retentionDays: 7,
    location: 's3://backups/production/incremental/2025-11-16',
  },
  {
    id: 'backup-3',
    name: 'Full Backup - 2025-11-15',
    type: 'full',
    status: 'completed',
    size: '2.3 TB',
    createdAt: '2025-11-15T00:00:00Z',
    completedAt: '2025-11-15T02:25:00Z',
    retentionDays: 30,
    location: 's3://backups/production/full/2025-11-15',
  },
  {
    id: 'backup-4',
    name: 'Incremental Backup - 2025-11-16',
    type: 'incremental',
    status: 'in-progress',
    size: '-',
    createdAt: '2025-11-16T18:00:00Z',
    retentionDays: 7,
    location: 's3://backups/production/incremental/2025-11-16-18',
  },
]

const MOCK_RESTORE_OPERATIONS: RestoreOperation[] = [
  {
    id: 'restore-1',
    backupId: 'backup-1',
    status: 'completed',
    startedAt: '2025-11-15T10:00:00Z',
    completedAt: '2025-11-15T11:30:00Z',
    targetEnvironment: 'staging',
  },
  {
    id: 'restore-2',
    backupId: 'backup-2',
    status: 'in-progress',
    startedAt: '2025-11-16T14:00:00Z',
    targetEnvironment: 'development',
  },
]

const NEXT_SCHEDULED_BACKUP = {
  type: 'incremental',
  scheduledAt: '2025-11-17T00:00:00Z',
  retentionDays: 7,
}

export function DisasterRecoveryUI() {
  const [backups, setBackups] = useState<Backup[]>(MOCK_BACKUPS)
  const [restoreOperations, setRestoreOperations] = useState<RestoreOperation[]>(MOCK_RESTORE_OPERATIONS)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
  const [restoreTarget, setRestoreTarget] = useState('')
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in-progress':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'in-progress':
        return 'default'
      case 'failed':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const handleManualBackup = () => {
    const newBackup: Backup = {
      id: `backup-${Date.now()}`,
      name: `Manual Backup - ${new Date().toISOString().split('T')[0]}`,
      type: 'full',
      status: 'in-progress',
      size: '-',
      createdAt: new Date().toISOString(),
      retentionDays: 30,
      location: `s3://backups/production/manual/${Date.now()}`,
    }
    setBackups([newBackup, ...backups])

    // Simulate completion after 2 seconds
    setTimeout(() => {
      setBackups((prev) =>
        prev.map((b) =>
          b.id === newBackup.id
            ? { ...b, status: 'completed' as const, size: '2.4 TB', completedAt: new Date().toISOString() }
            : b
        )
      )
    }, 2000)
  }

  const handleInitiateRestore = (backup: Backup) => {
    setSelectedBackup(backup)
    setIsRestoreDialogOpen(true)
  }

  const handleConfirmRestore = () => {
    if (!selectedBackup || !restoreTarget) return

    const newRestore: RestoreOperation = {
      id: `restore-${Date.now()}`,
      backupId: selectedBackup.id,
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      targetEnvironment: restoreTarget,
    }

    setRestoreOperations([newRestore, ...restoreOperations])
    setIsRestoreDialogOpen(false)
    setIsConfirmRestoreOpen(false)
    setSelectedBackup(null)
    setRestoreTarget('')

    // Simulate completion after 3 seconds
    setTimeout(() => {
      setRestoreOperations((prev) =>
        prev.map((r) =>
          r.id === newRestore.id
            ? { ...r, status: 'completed' as const, completedAt: new Date().toISOString() }
            : r
        )
      )
    }, 3000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeUntilNextBackup = () => {
    const now = new Date()
    const scheduled = new Date(NEXT_SCHEDULED_BACKUP.scheduledAt)
    const diff = scheduled.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Disaster Recovery</h2>
          <p className="text-muted-foreground mt-1">
            Manage backups and restore operations
          </p>
        </div>
        <Button onClick={handleManualBackup}>
          <Database className="h-4 w-4 mr-2" />
          Trigger Manual Backup
        </Button>
      </div>

      {/* Backup Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backups.find((b) => b.status === 'completed')?.name.split(' - ')[1] || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {backups.find((b) => b.status === 'completed')?.completedAt
                ? formatDate(backups.find((b) => b.status === 'completed')!.completedAt!)
                : 'No backups'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTimeUntilNextBackup()}</div>
            <p className="text-xs text-muted-foreground">
              {NEXT_SCHEDULED_BACKUP.type} backup
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backup Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backups.filter((b) => b.status === 'completed').length}/{backups.length}
            </div>
            <p className="text-xs text-muted-foreground">Successful backups</p>
          </CardContent>
        </Card>
      </div>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>View and manage backup operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{backup.name}</TableCell>
                  <TableCell>
                    <Badge variant={backup.type === 'full' ? 'default' : 'secondary'}>
                      {backup.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(backup.status)}
                      <Badge variant={getStatusBadgeVariant(backup.status)}>
                        {backup.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(backup.createdAt)}</TableCell>
                  <TableCell>
                    {backup.completedAt ? formatDate(backup.completedAt) : '-'}
                  </TableCell>
                  <TableCell>{backup.retentionDays} days</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {backup.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInitiateRestore(backup)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      )}
                      {backup.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Restore Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Restore Operations</CardTitle>
          <CardDescription>Monitor active and recent restore operations</CardDescription>
        </CardHeader>
        <CardContent>
          {restoreOperations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No restore operations
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Backup ID</TableHead>
                  <TableHead>Target Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restoreOperations.map((restore) => {
                  const backup = backups.find((b) => b.id === restore.backupId)
                  return (
                    <TableRow key={restore.id}>
                      <TableCell className="font-medium">{backup?.name || restore.backupId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{restore.targetEnvironment}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(restore.status)}
                          <Badge variant={getStatusBadgeVariant(restore.status)}>
                            {restore.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(restore.startedAt)}</TableCell>
                      <TableCell>
                        {restore.completedAt ? formatDate(restore.completedAt) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Restore Operation</DialogTitle>
            <DialogDescription>
              Restore from backup: {selectedBackup?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-md">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Backup Type:</span>
                  <span className="font-medium">{selectedBackup?.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-medium">{selectedBackup?.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {selectedBackup ? formatDate(selectedBackup.createdAt) : '-'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Environment</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={restoreTarget}
                onChange={(e) => setRestoreTarget(e.target.value)}
              >
                <option value="">Select environment</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
                <option value="production">Production</option>
              </select>
            </div>
            {restoreTarget === 'production' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-800">
                    Warning: Restoring to production will overwrite existing data.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <AlertDialog open={isConfirmRestoreOpen} onOpenChange={setIsConfirmRestoreOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  onClick={() => setIsConfirmRestoreOpen(true)}
                  disabled={!restoreTarget}
                >
                  Initiate Restore
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Restore Operation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to restore from "{selectedBackup?.name}" to "{restoreTarget}"?
                    {restoreTarget === 'production' && (
                      <span className="block mt-2 font-semibold text-red-600">
                        This will overwrite all data in production!
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmRestore}>
                    Confirm Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


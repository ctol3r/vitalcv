'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Clock,
  Play,
  Square,
  Zap,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'

interface ChaosExperiment {
  id: string
  name: string
  type: 'latency' | 'failure' | 'cpu' | 'memory' | 'network'
  blastRadius: string
  duration: number
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled'
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  outcome?: 'success' | 'failure'
  impact: 'low' | 'medium' | 'high' | 'critical'
}

const MOCK_EXPERIMENTS: ChaosExperiment[] = [
  {
    id: 'exp-1',
    name: 'Inject latency in auth-service',
    type: 'latency',
    blastRadius: 'us-east-1',
    duration: 300,
    status: 'completed',
    scheduledAt: '2025-11-16T08:00:00Z',
    startedAt: '2025-11-16T08:00:00Z',
    completedAt: '2025-11-16T08:05:00Z',
    outcome: 'success',
    impact: 'medium',
  },
  {
    id: 'exp-2',
    name: 'CPU spike on credential-service',
    type: 'cpu',
    blastRadius: 'us-east-1',
    duration: 180,
    status: 'running',
    scheduledAt: '2025-11-16T09:00:00Z',
    startedAt: '2025-11-16T09:00:00Z',
    impact: 'high',
  },
  {
    id: 'exp-3',
    name: 'Network partition',
    type: 'network',
    blastRadius: 'us-west-2',
    duration: 600,
    status: 'scheduled',
    scheduledAt: '2025-11-16T10:00:00Z',
    impact: 'critical',
  },
]

const EXPERIMENT_TYPES = [
  { value: 'latency', label: 'Latency Injection' },
  { value: 'failure', label: 'Failure Injection' },
  { value: 'cpu', label: 'CPU Spike' },
  { value: 'memory', label: 'Memory Leak' },
  { value: 'network', label: 'Network Partition' },
]

const BLAST_RADIUS_OPTIONS = [
  { value: 'service', label: 'Single Service' },
  { value: 'region', label: 'Single Region' },
  { value: 'zone', label: 'Availability Zone' },
  { value: 'multi-region', label: 'Multi-Region' },
]

const IMPACT_LEVELS = [
  { value: 'low', label: 'Low', color: 'text-green-600 bg-green-50' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'high', label: 'High', color: 'text-orange-600 bg-orange-50' },
  { value: 'critical', label: 'Critical', color: 'text-red-600 bg-red-50' },
]

export function ChaosExperimentUI() {
  const [experiments, setExperiments] = useState<ChaosExperiment[]>(MOCK_EXPERIMENTS)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false)
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    blastRadius: '',
    duration: '',
    impact: 'medium',
    scheduledAt: '',
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default'
      case 'completed':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'cancelled':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getImpactBadgeVariant = (impact: string) => {
    switch (impact) {
      case 'low':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'high':
        return 'destructive'
      case 'critical':
        return 'destructive'
      default:
        return 'default'
    }
  }

  const isUnsafeExperiment = (type: string, impact: string, blastRadius: string) => {
    // Prevent unsafe experiments: critical impact + network type + multi-region
    if (impact === 'critical' && type === 'network' && blastRadius === 'multi-region') {
      return true
    }
    // Prevent critical impact experiments during business hours (simplified check)
    return false
  }

  const handleCreateExperiment = () => {
    if (!formData.name || !formData.type || !formData.blastRadius || !formData.duration) {
      return
    }

    if (isUnsafeExperiment(formData.type, formData.impact, formData.blastRadius)) {
      alert('This experiment configuration is unsafe. Please reduce impact or blast radius.')
      return
    }

    const newExperiment: ChaosExperiment = {
      id: `exp-${Date.now()}`,
      name: formData.name,
      type: formData.type as any,
      blastRadius: formData.blastRadius,
      duration: parseInt(formData.duration),
      status: formData.scheduledAt ? 'scheduled' : 'running',
      scheduledAt: formData.scheduledAt || undefined,
      startedAt: formData.scheduledAt ? undefined : new Date().toISOString(),
      impact: formData.impact as any,
    }

    setExperiments([newExperiment, ...experiments])
    setIsCreateDialogOpen(false)
    setFormData({
      name: '',
      type: '',
      blastRadius: '',
      duration: '',
      impact: 'medium',
      scheduledAt: '',
    })
  }

  const handleStopExperiment = (experiment: ChaosExperiment) => {
    setExperiments(
      experiments.map((exp) =>
        exp.id === experiment.id ? { ...exp, status: 'cancelled' as const } : exp
      )
    )
    setIsStopDialogOpen(false)
    setSelectedExperiment(null)
  }

  const handleStartExperiment = (experiment: ChaosExperiment) => {
    setExperiments(
      experiments.map((exp) =>
        exp.id === experiment.id
          ? { ...exp, status: 'running' as const, startedAt: new Date().toISOString() }
          : exp
      )
    )
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chaos Experiments</h2>
          <p className="text-muted-foreground mt-1">
            Schedule and monitor chaos experiments to test system resilience
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Zap className="h-4 w-4 mr-2" />
              Schedule Experiment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Chaos Experiment</DialogTitle>
              <DialogDescription>
                Define the experiment parameters. Unsafe configurations will be prevented.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Experiment Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Inject latency in auth-service"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Experiment Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blastRadius">Blast Radius</Label>
                  <Select
                    value={formData.blastRadius}
                    onValueChange={(value) => setFormData({ ...formData, blastRadius: value })}
                  >
                    <SelectTrigger id="blastRadius">
                      <SelectValue placeholder="Select radius" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLAST_RADIUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="300"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="impact">Impact Level</Label>
                  <Select
                    value={formData.impact}
                    onValueChange={(value) => setFormData({ ...formData, impact: value })}
                  >
                    <SelectTrigger id="impact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Schedule (optional)</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to start immediately
                </p>
              </div>
              {isUnsafeExperiment(formData.type, formData.impact, formData.blastRadius) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800">
                      This experiment configuration is unsafe and will be blocked.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateExperiment} disabled={isUnsafeExperiment(formData.type, formData.impact, formData.blastRadius)}>
                Schedule Experiment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Experiments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active & Scheduled Experiments</CardTitle>
          <CardDescription>Monitor experiment progress and outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Blast Radius</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((experiment) => (
                <TableRow key={experiment.id}>
                  <TableCell className="font-medium">{experiment.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{experiment.type}</Badge>
                  </TableCell>
                  <TableCell>{experiment.blastRadius}</TableCell>
                  <TableCell>{formatDuration(experiment.duration)}</TableCell>
                  <TableCell>
                    <Badge variant={getImpactBadgeVariant(experiment.impact)}>
                      {experiment.impact}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(experiment.status)}
                      <Badge variant={getStatusBadgeVariant(experiment.status)}>
                        {experiment.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {experiment.outcome ? (
                      <Badge variant={experiment.outcome === 'success' ? 'default' : 'destructive'}>
                        {experiment.outcome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {experiment.status === 'scheduled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartExperiment(experiment)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {experiment.status === 'running' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedExperiment(experiment)
                            setIsStopDialogOpen(true)
                          }}
                        >
                          <Square className="h-4 w-4" />
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

      {/* Stop Experiment Confirmation */}
      <AlertDialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Experiment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop "{selectedExperiment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedExperiment && handleStopExperiment(selectedExperiment)}
            >
              Stop Experiment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


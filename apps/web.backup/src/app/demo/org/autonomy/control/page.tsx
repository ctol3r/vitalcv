'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Power,
  RefreshCw,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface PendingAction {
  id: string
  type: 'issuance' | 'revocation' | 'renewal' | 'update'
  target: string
  reason: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  scheduledAt: string
  status: 'pending' | 'approved' | 'blocked'
}

interface Override {
  id: string
  actionId: string
  reason: string
  initiatedBy: string
  timestamp: string
  status: 'active' | 'resolved'
}

interface BiasDetection {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: string
  description: string
  affectedCount: number
  status: 'detected' | 'investigating' | 'resolved'
}

interface AutonomyStatus {
  isActive: boolean
  workflowsRunning: number
  pendingActions: number
  overrides: number
  biasesDetected: number
  lastUpdated: string
}

export default function AutonomyControlPanelPage() {
  const [status, setStatus] = useState<AutonomyStatus | null>(null)
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [biases, setBiases] = useState<BiasDetection[]>([])
  const [loading, setLoading] = useState(true)
  const [killSwitchOpen, setKillSwitchOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadAutonomyData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadAutonomyData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  async function loadAutonomyData() {
    try {
      // In a real implementation, this would fetch from API endpoints
      const [statusRes, actionsRes, overridesRes, biasesRes] = await Promise.all([
        fetch('/api/demo/org/autonomy/status'),
        fetch('/api/demo/org/autonomy/pending-actions'),
        fetch('/api/demo/org/autonomy/overrides'),
        fetch('/api/demo/org/autonomy/biases'),
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData.status || mockStatus())
      }
      if (actionsRes.ok) {
        const actionsData = await actionsRes.json()
        setPendingActions(actionsData.actions || mockPendingActions())
      }
      if (overridesRes.ok) {
        const overridesData = await overridesRes.json()
        setOverrides(overridesData.overrides || mockOverrides())
      }
      if (biasesRes.ok) {
        const biasesData = await biasesRes.json()
        setBiases(biasesData.biases || mockBiases())
      }
    } catch (err) {
      // Fallback to mock data for demo
      setStatus(mockStatus())
      setPendingActions(mockPendingActions())
      setOverrides(mockOverrides())
      setBiases(mockBiases())
    } finally {
      setLoading(false)
    }
  }

  function handleKillSwitch() {
    setStatus((prev) => (prev ? { ...prev, isActive: false, workflowsRunning: 0 } : null))
    setKillSwitchOpen(false)
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Autonomy Control Panel
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time status of autonomous workflows, pending actions, overrides, and bias detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setKillSwitchOpen(true)}
            disabled={!status?.isActive}
          >
            <Power className="w-4 h-4 mr-2" />
            Emergency Kill Switch
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className={status.isActive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              {status.isActive ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {status.isActive ? 'ACTIVE' : 'DISABLED'}
              </div>
              <p className="text-xs text-muted-foreground">
                {status.workflowsRunning} workflows running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.pendingActions}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Overrides</CardTitle>
              <ShieldAlert className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.overrides}</div>
              <p className="text-xs text-muted-foreground">
                Manual interventions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bias Detections</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.biasesDetected}</div>
              <p className="text-xs text-muted-foreground">
                Requiring review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {new Date(status.lastUpdated).toLocaleTimeString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(status.lastUpdated).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Views */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Actions ({pendingActions.length})
          </TabsTrigger>
          <TabsTrigger value="overrides">
            Overrides ({overrides.length})
          </TabsTrigger>
          <TabsTrigger value="biases">
            Bias Detections ({biases.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Autonomous Actions</CardTitle>
              <CardDescription>
                Credential actions scheduled for autonomous execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <Badge variant="outline">{action.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{action.target}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(action.priority)}>
                          {action.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(action.scheduledAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            action.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : action.status === 'blocked'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {action.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{action.reason}</TableCell>
                    </TableRow>
                  ))}
                  {pendingActions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No pending actions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Overrides</CardTitle>
              <CardDescription>
                Manual interventions that have overridden autonomous workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action ID</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((override) => (
                    <TableRow key={override.id}>
                      <TableCell className="font-mono text-sm">{override.actionId}</TableCell>
                      <TableCell>{override.initiatedBy}</TableCell>
                      <TableCell>
                        {new Date(override.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            override.status === 'active'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {override.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">{override.reason}</TableCell>
                    </TableRow>
                  ))}
                  {overrides.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No active overrides
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bias Detections</CardTitle>
              <CardDescription>
                Detected biases in autonomous decision-making processes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Detected At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Affected</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {biases.map((bias) => (
                    <TableRow key={bias.id}>
                      <TableCell>
                        <Badge variant="outline">{bias.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(bias.severity)}>
                          {bias.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(bias.detectedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            bias.status === 'resolved'
                              ? 'bg-green-100 text-green-800'
                              : bias.status === 'investigating'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {bias.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{bias.affectedCount} actions</TableCell>
                      <TableCell className="max-w-md">{bias.description}</TableCell>
                    </TableRow>
                  ))}
                  {biases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No bias detections
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Kill Switch Dialog */}
      <AlertDialog open={killSwitchOpen} onOpenChange={setKillSwitchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emergency Kill Switch</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately halt all autonomous workflows and prevent any new autonomous
              actions from being executed. All pending actions will be paused and require manual
              review before resuming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleKillSwitch} className="bg-red-600 hover:bg-red-700">
              Activate Kill Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Mock data functions
function mockStatus(): AutonomyStatus {
  return {
    isActive: true,
    workflowsRunning: 12,
    pendingActions: 5,
    overrides: 2,
    biasesDetected: 3,
    lastUpdated: new Date().toISOString(),
  }
}

function mockPendingActions(): PendingAction[] {
  return [
    {
      id: 'act-001',
      type: 'issuance',
      target: 'Dr. Sarah Chen',
      reason: 'Automatic credential issuance based on completed training',
      priority: 'medium',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
    },
    {
      id: 'act-002',
      type: 'renewal',
      target: 'Dr. Michael Torres',
      reason: 'Scheduled renewal for expiring credential',
      priority: 'high',
      scheduledAt: new Date(Date.now() + 7200000).toISOString(),
      status: 'approved',
    },
    {
      id: 'act-003',
      type: 'revocation',
      target: 'Dr. James Wilson',
      reason: 'Policy violation detected in audit',
      priority: 'critical',
      scheduledAt: new Date(Date.now() + 1800000).toISOString(),
      status: 'blocked',
    },
    {
      id: 'act-004',
      type: 'update',
      target: 'PA. Lisa Park',
      reason: 'Privilege expansion based on competency assessment',
      priority: 'low',
      scheduledAt: new Date(Date.now() + 5400000).toISOString(),
      status: 'pending',
    },
    {
      id: 'act-005',
      type: 'issuance',
      target: 'NP. David Kim',
      reason: 'New hire credential provisioning',
      priority: 'medium',
      scheduledAt: new Date(Date.now() + 900000).toISOString(),
      status: 'approved',
    },
  ]
}

function mockOverrides(): Override[] {
  return [
    {
      id: 'ovr-001',
      actionId: 'act-003',
      reason: 'Manual review required due to policy conflict',
      initiatedBy: 'Admin User',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'active',
    },
    {
      id: 'ovr-002',
      actionId: 'act-007',
      reason: 'Temporary hold for compliance audit',
      initiatedBy: 'Compliance Officer',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'active',
    },
  ]
}

function mockBiases(): BiasDetection[] {
  return [
    {
      id: 'bias-001',
      type: 'Demographic Disparity',
      severity: 'high',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
      description: 'Significant difference in approval rates across demographic groups',
      affectedCount: 23,
      status: 'investigating',
    },
    {
      id: 'bias-002',
      type: 'Geographic Bias',
      severity: 'medium',
      detectedAt: new Date(Date.now() - 10800000).toISOString(),
      description: 'Uneven credential processing times by region',
      affectedCount: 15,
      status: 'detected',
    },
    {
      id: 'bias-003',
      type: 'Temporal Pattern',
      severity: 'low',
      detectedAt: new Date(Date.now() - 14400000).toISOString(),
      description: 'Unusual pattern detected in time-based decisions',
      affectedCount: 8,
      status: 'resolved',
    },
  ]
}


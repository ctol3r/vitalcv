'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  Target,
  TrendingUp,
  Zap,
  Shield,
  Gauge,
  RefreshCw,
  Play,
  Check,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
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
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface OrgObjectives {
  orgId: string
  quality: { weight: number; target: number; current: number }
  throughput: { weight: number; target: number; current: number }
  safety: { weight: number; target: number; current: number }
  updatedAt: string
}

interface PolicyStats {
  taskStats: Record<string, { successRate: number; avgDuration: number; sampleCount: number }>
  overallSuccessRate: number
  policyVersion: string
}

interface AlignmentMetrics {
  compositeScore: number
  qualityAlignment: number
  throughputAlignment: number
  safetyAlignment: number
  recommendations: string[]
}

interface ResourceAllocation {
  totalModules: number
  totalBandwidth: number
  averageStability: number
  averageForecastedLoad: number
  allocations: Array<{
    moduleId: string
    priority: number
    stability: number
    forecastedLoad: number
    allocatedBandwidth: number
    maxConcurrentJobs: number
    maxPendingJobs: number
  }>
}

interface UpgradePlan {
  id: string
  targetId: string
  targetType: 'module' | 'plugin' | 'model_slot'
  currentVersion: string
  targetVersion: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  riskLevel: 'low' | 'medium' | 'high'
  estimatedDuration: number
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rolled_back' | 'cancelled'
  approvalRequired: boolean
  createdAt: string
}

interface UpgradeRecommendation {
  targetId: string
  targetType: 'module' | 'plugin' | 'model_slot'
  currentVersion: string
  recommendedVersion: string
  reason: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  estimatedImpact: {
    performance: number
    stability: number
    security: number
  }
}

interface GovernanceData {
  objectives: OrgObjectives
  policyStats: PolicyStats
  alignmentMetrics: AlignmentMetrics
  resourceAllocation: ResourceAllocation
  upgradePlans: UpgradePlan[]
  recommendations: UpgradeRecommendation[]
}

export default function GovernanceConfigPage() {
  const [data, setData] = useState<GovernanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [objectives, setObjectives] = useState<OrgObjectives | null>(null)
  const [showObjectivesDialog, setShowObjectivesDialog] = useState(false)
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradePlan | null>(null)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const response = await fetch('/api/demo/org/governance')
      if (!response.ok) {
        throw new Error(`Failed to load governance data (${response.status})`)
      }
      const payload = await response.json()
      setData(payload)
      setObjectives(payload.objectives)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load governance data')
    } finally {
      setLoading(false)
    }
  }

  async function updateObjectives() {
    if (!objectives) return
    try {
      const response = await fetch('/api/demo/org/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateObjectives',
          objectives,
        }),
      })
      if (!response.ok) throw new Error('Failed to update objectives')
      setShowObjectivesDialog(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function approveUpgrade(planId: string) {
    try {
      const response = await fetch('/api/demo/org/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approveUpgrade',
          planId,
        }),
      })
      if (!response.ok) throw new Error('Failed to approve upgrade')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function startUpgrade(planId: string) {
    try {
      const response = await fetch('/api/demo/org/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startUpgrade',
          planId,
        }),
      })
      if (!response.ok) throw new Error('Failed to start upgrade')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading governance data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load governance data</CardTitle>
            <CardDescription>{error || 'Unknown error'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Governance</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-7 w-7 text-primary" aria-hidden="true" />
              Governance Configuration
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Configure organizational objectives, review adaptive policy changes, approve upgrade plans, and monitor alignment metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="objectives" className="space-y-6">
        <TabsList>
          <TabsTrigger value="objectives">Objectives</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
        </TabsList>

        <TabsContent value="objectives" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Quality
                </CardTitle>
                <CardDescription>
                  Current: {(data.objectives.quality.current * 100).toFixed(1)}% / Target:{' '}
                  {(data.objectives.quality.target * 100).toFixed(1)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Weight</span>
                    <span>{(data.objectives.quality.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(data.objectives.quality.current / data.objectives.quality.target) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Throughput
                </CardTitle>
                <CardDescription>
                  Current: {data.objectives.throughput.current} / Target: {data.objectives.throughput.target} tasks/hr
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Weight</span>
                    <span>{(data.objectives.throughput.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(data.objectives.throughput.current / data.objectives.throughput.target) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety
                </CardTitle>
                <CardDescription>
                  Current: {(data.objectives.safety.current * 100).toFixed(1)}% / Target:{' '}
                  {(data.objectives.safety.target * 100).toFixed(1)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Weight</span>
                    <span>{(data.objectives.safety.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(data.objectives.safety.current / data.objectives.safety.target) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Alignment Metrics</CardTitle>
              <CardDescription>Composite score: {(data.alignmentMetrics.compositeScore * 100).toFixed(1)}%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Quality Alignment</div>
                  <div className="text-2xl font-bold">
                    {(data.alignmentMetrics.qualityAlignment * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Throughput Alignment</div>
                  <div className="text-2xl font-bold">
                    {(data.alignmentMetrics.throughputAlignment * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Safety Alignment</div>
                  <div className="text-2xl font-bold">
                    {(data.alignmentMetrics.safetyAlignment * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              {data.alignmentMetrics.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recommendations:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {data.alignmentMetrics.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configure Objectives</CardTitle>
              <CardDescription>Set organizational goals and weights</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowObjectivesDialog(true)}>Edit Objectives</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Policy Statistics</CardTitle>
              <CardDescription>
                Overall success rate: {(data.policyStats.overallSuccessRate * 100).toFixed(1)}% (Policy {data.policyStats.policyVersion})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Type</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Duration</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.policyStats.taskStats).map(([taskType, stats]) => (
                    <TableRow key={taskType}>
                      <TableCell className="font-mono text-sm">{taskType}</TableCell>
                      <TableCell>
                        <Badge variant={stats.successRate >= 0.95 ? 'default' : 'destructive'}>
                          {(stats.successRate * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{(stats.avgDuration / 1000 / 60).toFixed(1)} min</TableCell>
                      <TableCell>{stats.sampleCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              label="Total Modules"
              value={data.resourceAllocation.totalModules.toString()}
              icon={Activity}
            />
            <SummaryCard
              label="Avg Stability"
              value={(data.resourceAllocation.averageStability * 100).toFixed(1) + '%'}
              icon={Gauge}
            />
            <SummaryCard
              label="Forecasted Load"
              value={data.resourceAllocation.averageForecastedLoad.toString()}
              icon={TrendingUp}
            />
            <SummaryCard
              label="Total Bandwidth"
              value={(data.resourceAllocation.totalBandwidth * 100).toFixed(0) + '%'}
              icon={Zap}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Resource Allocations</CardTitle>
              <CardDescription>Bandwidth allocation by module</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Stability</TableHead>
                    <TableHead>Forecasted Load</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Max Concurrent</TableHead>
                    <TableHead>Max Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.resourceAllocation.allocations.map((alloc) => (
                    <TableRow key={alloc.moduleId}>
                      <TableCell className="font-medium">{alloc.moduleId}</TableCell>
                      <TableCell>{alloc.priority}</TableCell>
                      <TableCell>
                        <Badge variant={alloc.stability >= 0.95 ? 'default' : 'secondary'}>
                          {(alloc.stability * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{alloc.forecastedLoad}</TableCell>
                      <TableCell>{(alloc.allocatedBandwidth * 100).toFixed(1)}%</TableCell>
                      <TableCell>{alloc.maxConcurrentJobs}</TableCell>
                      <TableCell>{alloc.maxPendingJobs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upgrades" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Plans</CardTitle>
              <CardDescription>Planned and in-progress upgrades</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Current → Target</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upgradePlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.targetId}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {plan.currentVersion} → {plan.targetVersion}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.priority === 'critical'
                              ? 'destructive'
                              : plan.priority === 'high'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {plan.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.riskLevel === 'high' ? 'destructive' : 'outline'}>
                          {plan.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.status === 'completed'
                              ? 'default'
                              : plan.status === 'in_progress'
                                ? 'default'
                                : plan.status === 'rolled_back'
                                  ? 'destructive'
                                  : 'secondary'
                          }
                        >
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {plan.status === 'pending' && plan.approvalRequired && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveUpgrade(plan.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {plan.status === 'approved' && (
                            <Button size="sm" variant="default" onClick={() => startUpgrade(plan.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUpgrade(plan)
                              setShowUpgradeDialog(true)
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.upgradePlans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No upgrade plans available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upgrade Recommendations</CardTitle>
                <CardDescription>Suggested upgrades based on analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Current → Recommended</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recommendations.map((rec) => (
                      <TableRow key={rec.targetId}>
                        <TableCell className="font-medium">{rec.targetId}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {rec.currentVersion} → {rec.recommendedVersion}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rec.urgency === 'critical'
                                ? 'destructive'
                                : rec.urgency === 'high'
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {rec.urgency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{rec.reason}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Create upgrade plan from recommendation
                              // In production, this would call the API
                            }}
                          >
                            Create Plan
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showObjectivesDialog} onOpenChange={setShowObjectivesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Objectives</DialogTitle>
            <DialogDescription>
              Set organizational goals and their relative weights. Weights must sum to 1.0.
            </DialogDescription>
          </DialogHeader>
          {objectives && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Quality Target (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={objectives.quality.target}
                    onChange={(e) =>
                      setObjectives({
                        ...objectives,
                        quality: { ...objectives.quality, target: parseFloat(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quality Weight: {(objectives.quality.weight * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[objectives.quality.weight]}
                    onValueChange={([value]) =>
                      setObjectives({
                        ...objectives,
                        quality: { ...objectives.quality, weight: value },
                      })
                    }
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Throughput Target (tasks/hour)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={objectives.throughput.target}
                    onChange={(e) =>
                      setObjectives({
                        ...objectives,
                        throughput: { ...objectives.throughput, target: parseFloat(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Throughput Weight: {(objectives.throughput.weight * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[objectives.throughput.weight]}
                    onValueChange={([value]) =>
                      setObjectives({
                        ...objectives,
                        throughput: { ...objectives.throughput, weight: value },
                      })
                    }
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Safety Target (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={objectives.safety.target}
                    onChange={(e) =>
                      setObjectives({
                        ...objectives,
                        safety: { ...objectives.safety, target: parseFloat(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Safety Weight: {(objectives.safety.weight * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[objectives.safety.weight]}
                    onValueChange={([value]) =>
                      setObjectives({
                        ...objectives,
                        safety: { ...objectives.safety, weight: value },
                      })
                    }
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowObjectivesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateObjectives}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Plan Details</DialogTitle>
            <DialogDescription>
              {selectedUpgrade?.targetId} ({selectedUpgrade?.targetType})
            </DialogDescription>
          </DialogHeader>
          {selectedUpgrade && (
            <div className="space-y-4 py-4">
              <div>
                <div className="text-sm font-medium">Version</div>
                <div className="text-muted-foreground">
                  {selectedUpgrade.currentVersion} → {selectedUpgrade.targetVersion}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Priority</div>
                <Badge>{selectedUpgrade.priority}</Badge>
              </div>
              <div>
                <div className="text-sm font-medium">Risk Level</div>
                <Badge variant={selectedUpgrade.riskLevel === 'high' ? 'destructive' : 'outline'}>
                  {selectedUpgrade.riskLevel}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium">Estimated Duration</div>
                <div className="text-muted-foreground">{selectedUpgrade.estimatedDuration} minutes</div>
              </div>
              <div>
                <div className="text-sm font-medium">Status</div>
                <Badge>{selectedUpgrade.status}</Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type SummaryCardProps = {
  label: string
  value: string
  icon: typeof Activity
}

function SummaryCard({ label, value, icon: Icon }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}


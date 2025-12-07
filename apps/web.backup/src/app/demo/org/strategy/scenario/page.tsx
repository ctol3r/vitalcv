'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

type InterventionType = 'add_staff' | 'shift_schedule' | 'upgrade_privileges' | 'renew_early' | 'expand_department'

interface Intervention {
  id: string
  type: InterventionType
  label: string
  department?: string
  role?: string
  count?: number
  privilege?: string
  enabled: boolean
}

interface Projection {
  metric: string
  baseline: number
  projected: number
  change: number
  changePercent: number
  trend: 'improving' | 'declining' | 'stable'
}

const INTERVENTION_TYPES: Record<InterventionType, { label: string; icon: typeof UsersRound; description: string }> = {
  add_staff: {
    label: 'Add Staff',
    icon: UsersRound,
    description: 'Add clinicians to a department/role',
  },
  shift_schedule: {
    label: 'Shift to Telehealth',
    icon: Settings,
    description: 'Shift schedule to telehealth delivery',
  },
  upgrade_privileges: {
    label: 'Upgrade Privileges',
    icon: Zap,
    description: 'Upgrade privilege set for clinicians',
  },
  renew_early: {
    label: 'Renew Early',
    icon: CheckCircle2,
    description: 'Renew credentials early to avoid bottlenecks',
  },
  expand_department: {
    label: 'Expand Department',
    icon: TrendingUp,
    description: 'Expand department capacity',
  },
}

const DEPARTMENTS = ['ICU', 'ED', 'Cath Lab', 'Telehealth', 'Med/Surg']
const ROLES = ['Intensivist', 'Emergency MD', 'Interventional Card', 'Behavioral Health', 'Hospitalist', 'APP', 'RN']
const PRIVILEGES = ['Critical Care', 'Interventional Cardiology', 'Emergency Medicine', 'Telehealth Behavioral', 'Hospitalist']

export default function OrgScenarioSimulatorPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('custom')

  // Calculate projections based on interventions
  const projections = useMemo((): Projection[] => {
    const enabledInterventions = interventions.filter((i) => i.enabled)

    // Baseline metrics
    const baseline = {
      workforceReadiness: 72,
      safetyStress: 55,
      enrollmentCoverage: 82,
      privilegeCapacity: 45,
      predictedShortages: 4,
      credentialBottlenecks: 3,
    }

    let projected = { ...baseline }

    enabledInterventions.forEach((intervention) => {
      switch (intervention.type) {
        case 'add_staff':
          if (intervention.count) {
            projected.workforceReadiness += intervention.count * 2
            projected.predictedShortages = Math.max(0, projected.predictedShortages - Math.floor(intervention.count / 2))
          }
          break
        case 'shift_schedule':
          projected.safetyStress -= 5
          projected.workforceReadiness += 3
          break
        case 'upgrade_privileges':
          projected.privilegeCapacity += 5
          projected.workforceReadiness += 2
          break
        case 'renew_early':
          projected.credentialBottlenecks = Math.max(0, projected.credentialBottlenecks - 1)
          projected.workforceReadiness += 3
          break
        case 'expand_department':
          projected.workforceReadiness += 4
          projected.enrollmentCoverage += 2
          break
      }
    })

    // Cap values
    projected.workforceReadiness = Math.min(100, Math.max(0, projected.workforceReadiness))
    projected.safetyStress = Math.min(100, Math.max(0, projected.safetyStress))
    projected.enrollmentCoverage = Math.min(100, Math.max(0, projected.enrollmentCoverage))
    projected.privilegeCapacity = Math.max(0, projected.privilegeCapacity)
    projected.predictedShortages = Math.max(0, projected.predictedShortages)
    projected.credentialBottlenecks = Math.max(0, projected.credentialBottlenecks)

    return [
      {
        metric: 'Workforce Readiness',
        baseline: baseline.workforceReadiness,
        projected: projected.workforceReadiness,
        change: projected.workforceReadiness - baseline.workforceReadiness,
        changePercent: ((projected.workforceReadiness - baseline.workforceReadiness) / baseline.workforceReadiness) * 100,
        trend: projected.workforceReadiness > baseline.workforceReadiness ? 'improving' : 'declining',
      },
      {
        metric: 'Safety Stress',
        baseline: baseline.safetyStress,
        projected: projected.safetyStress,
        change: projected.safetyStress - baseline.safetyStress,
        changePercent: ((projected.safetyStress - baseline.safetyStress) / baseline.safetyStress) * 100,
        trend: projected.safetyStress < baseline.safetyStress ? 'improving' : 'declining',
      },
      {
        metric: 'Enrollment Coverage',
        baseline: baseline.enrollmentCoverage,
        projected: projected.enrollmentCoverage,
        change: projected.enrollmentCoverage - baseline.enrollmentCoverage,
        changePercent: ((projected.enrollmentCoverage - baseline.enrollmentCoverage) / baseline.enrollmentCoverage) * 100,
        trend: projected.enrollmentCoverage > baseline.enrollmentCoverage ? 'improving' : 'declining',
      },
      {
        metric: 'Privilege Capacity',
        baseline: baseline.privilegeCapacity,
        projected: projected.privilegeCapacity,
        change: projected.privilegeCapacity - baseline.privilegeCapacity,
        changePercent: ((projected.privilegeCapacity - baseline.privilegeCapacity) / baseline.privilegeCapacity) * 100,
        trend: projected.privilegeCapacity > baseline.privilegeCapacity ? 'improving' : 'declining',
      },
      {
        metric: 'Predicted Shortages',
        baseline: baseline.predictedShortages,
        projected: projected.predictedShortages,
        change: projected.predictedShortages - baseline.predictedShortages,
        changePercent: ((projected.predictedShortages - baseline.predictedShortages) / baseline.predictedShortages) * 100,
        trend: projected.predictedShortages < baseline.predictedShortages ? 'improving' : 'declining',
      },
      {
        metric: 'Credential Bottlenecks',
        baseline: baseline.credentialBottlenecks,
        projected: projected.credentialBottlenecks,
        change: projected.credentialBottlenecks - baseline.credentialBottlenecks,
        changePercent: ((projected.credentialBottlenecks - baseline.credentialBottlenecks) / baseline.credentialBottlenecks) * 100,
        trend: projected.credentialBottlenecks < baseline.credentialBottlenecks ? 'improving' : 'declining',
      },
    ]
  }, [interventions])

  const addIntervention = (type: InterventionType) => {
    const newIntervention: Intervention = {
      id: `intervention-${Date.now()}`,
      type,
      label: INTERVENTION_TYPES[type].label,
      enabled: true,
    }

    // Set defaults based on type
    if (type === 'add_staff') {
      newIntervention.department = DEPARTMENTS[0]
      newIntervention.role = ROLES[0]
      newIntervention.count = 1
    } else if (type === 'shift_schedule') {
      newIntervention.department = DEPARTMENTS[0]
    } else if (type === 'upgrade_privileges') {
      newIntervention.privilege = PRIVILEGES[0]
      newIntervention.count = 1
    } else if (type === 'expand_department') {
      newIntervention.department = DEPARTMENTS[0]
      newIntervention.count = 1
    }

    setInterventions([...interventions, newIntervention])
  }

  const updateIntervention = (id: string, updates: Partial<Intervention>) => {
    setInterventions(interventions.map((i) => (i.id === id ? { ...i, ...updates } : i)))
  }

  const removeIntervention = (id: string) => {
    setInterventions(interventions.filter((i) => i.id !== id))
  }

  const toggleIntervention = (id: string) => {
    setInterventions(interventions.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)))
  }

  const loadPresetScenario = (scenario: string) => {
    setSelectedScenario(scenario)
    if (scenario === 'add_cardiologists') {
      setInterventions([
        {
          id: 'preset-1',
          type: 'add_staff',
          label: 'Add Staff',
          department: 'Cath Lab',
          role: 'Interventional Card',
          count: 10,
          enabled: true,
        },
      ])
    } else if (scenario === 'telehealth_shift') {
      setInterventions([
        {
          id: 'preset-2',
          type: 'shift_schedule',
          label: 'Shift to Telehealth',
          department: 'Med/Surg',
          enabled: true,
        },
      ])
    } else if (scenario === 'upgrade_privileges') {
      setInterventions([
        {
          id: 'preset-3',
          type: 'upgrade_privileges',
          label: 'Upgrade Privileges',
          privilege: 'Interventional Cardiology',
          count: 15,
          enabled: true,
        },
      ])
    } else {
      setInterventions([])
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link href="/demo/org/strategy">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Org Scenario Simulator
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Play with org-level interventions: add staff, shift schedules, upgrade privileges, and view projected
          outcomes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Interventions Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interventions</CardTitle>
              <CardDescription>Add and configure org-level interventions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Scenarios */}
              <div className="space-y-2">
                <Label>Preset Scenarios</Label>
                <Select value={selectedScenario} onValueChange={loadPresetScenario}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Scenario</SelectItem>
                    <SelectItem value="add_cardiologists">Add 10 Cardiologists</SelectItem>
                    <SelectItem value="telehealth_shift">Shift Schedule to Telehealth</SelectItem>
                    <SelectItem value="upgrade_privileges">Upgrade Privileges</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Add Intervention Buttons */}
              <div className="space-y-2">
                <Label>Add Intervention</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(INTERVENTION_TYPES).map(([type, config]) => {
                    const Icon = config.icon
                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => addIntervention(type as InterventionType)}
                        className="flex flex-col items-center gap-1 h-auto py-3"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{config.label}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Intervention List */}
              <div className="space-y-2">
                <Label>Active Interventions ({interventions.length})</Label>
                {interventions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No interventions added</p>
                ) : (
                  <div className="space-y-2">
                    {interventions.map((intervention) => {
                      const config = INTERVENTION_TYPES[intervention.type]
                      const Icon = config.icon
                      return (
                        <div
                          key={intervention.id}
                          className={cn(
                            'p-3 border rounded-lg space-y-2',
                            intervention.enabled ? 'bg-background' : 'bg-muted/30 opacity-60',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{config.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch checked={intervention.enabled} onCheckedChange={() => toggleIntervention(intervention.id)} />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeIntervention(intervention.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Type-specific fields */}
                          {intervention.type === 'add_staff' && (
                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Department</Label>
                                  <Select
                                    value={intervention.department || ''}
                                    onValueChange={(value) => updateIntervention(intervention.id, { department: value })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DEPARTMENTS.map((dept) => (
                                        <SelectItem key={dept} value={dept}>
                                          {dept}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Role</Label>
                                  <Select
                                    value={intervention.role || ''}
                                    onValueChange={(value) => updateIntervention(intervention.id, { role: value })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>
                                          {role}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Count</Label>
                                <Input
                                  type="number"
                                  value={intervention.count || 0}
                                  onChange={(e) => updateIntervention(intervention.id, { count: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-xs"
                                  min="1"
                                />
                              </div>
                            </div>
                          )}

                          {intervention.type === 'shift_schedule' && (
                            <div className="space-y-2 text-sm">
                              <div>
                                <Label className="text-xs">Department</Label>
                                <Select
                                  value={intervention.department || ''}
                                  onValueChange={(value) => updateIntervention(intervention.id, { department: value })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DEPARTMENTS.map((dept) => (
                                      <SelectItem key={dept} value={dept}>
                                        {dept}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {intervention.type === 'upgrade_privileges' && (
                            <div className="space-y-2 text-sm">
                              <div>
                                <Label className="text-xs">Privilege</Label>
                                <Select
                                  value={intervention.privilege || ''}
                                  onValueChange={(value) => updateIntervention(intervention.id, { privilege: value })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIVILEGES.map((priv) => (
                                      <SelectItem key={priv} value={priv}>
                                        {priv}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Count</Label>
                                <Input
                                  type="number"
                                  value={intervention.count || 0}
                                  onChange={(e) => updateIntervention(intervention.id, { count: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-xs"
                                  min="1"
                                />
                              </div>
                            </div>
                          )}

                          {intervention.type === 'expand_department' && (
                            <div className="space-y-2 text-sm">
                              <div>
                                <Label className="text-xs">Department</Label>
                                <Select
                                  value={intervention.department || ''}
                                  onValueChange={(value) => updateIntervention(intervention.id, { department: value })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DEPARTMENTS.map((dept) => (
                                      <SelectItem key={dept} value={dept}>
                                        {dept}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projections Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Projected Outcomes</CardTitle>
              <CardDescription>View how interventions affect key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projections.map((projection) => (
                  <div key={projection.metric} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{projection.metric}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Baseline: {projection.baseline}</p>
                          <p className="text-lg font-semibold">Projected: {projection.projected}</p>
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded',
                            projection.trend === 'improving'
                              ? 'bg-emerald-50 text-emerald-900'
                              : projection.trend === 'declining'
                                ? 'bg-rose-50 text-rose-900'
                                : 'bg-slate-50 text-slate-900',
                          )}
                        >
                          {projection.trend === 'improving' && <TrendingUp className="h-4 w-4" />}
                          {projection.trend === 'declining' && <TrendingDown className="h-4 w-4" />}
                          <span className="font-semibold text-sm">
                            {projection.change > 0 ? '+' : ''}
                            {projection.change.toFixed(1)} ({projection.changePercent > 0 ? '+' : ''}
                            {projection.changePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-slate-400"
                          style={{ width: `${(projection.baseline / 100) * 100}%` }}
                        />
                        <div
                          className={cn(
                            'transition-all',
                            projection.trend === 'improving'
                              ? 'bg-emerald-500'
                              : projection.trend === 'declining'
                                ? 'bg-rose-500'
                                : 'bg-slate-400',
                          )}
                          style={{ width: `${Math.abs((projection.change / 100) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Active Interventions</p>
                  <p className="text-2xl font-bold">{interventions.filter((i) => i.enabled).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Improving Metrics</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {projections.filter((p) => p.trend === 'improving').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

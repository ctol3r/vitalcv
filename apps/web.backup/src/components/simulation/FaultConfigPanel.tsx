'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, AlertTriangle, Zap, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaultConfig } from '@/app/demo/org/simulation/page'

const FAULT_TYPES = [
  {
    id: 'latency',
    name: 'Latency Injection',
    description: 'Introduce delays in module responses',
    icon: Zap,
  },
  {
    id: 'error',
    name: 'Error Injection',
    description: 'Force modules to return errors',
    icon: XCircle,
  },
  {
    id: 'timeout',
    name: 'Timeout',
    description: 'Simulate request timeouts',
    icon: AlertTriangle,
  },
  {
    id: 'partial_failure',
    name: 'Partial Failure',
    description: 'Some requests succeed, others fail',
    icon: Info,
  },
  {
    id: 'data_corruption',
    name: 'Data Corruption',
    description: 'Corrupt data in responses',
    icon: XCircle,
  },
  {
  id: 'rate_limit',
    name: 'Rate Limiting',
    description: 'Simulate rate limit errors',
    icon: AlertTriangle,
  },
]

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-blue-50 text-blue-900 border-blue-200', impact: 'Minimal impact' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-50 text-amber-900 border-amber-200', impact: 'Moderate impact' },
  { value: 'high', label: 'High', color: 'bg-orange-50 text-orange-900 border-orange-200', impact: 'Significant impact' },
  { value: 'critical', label: 'Critical', color: 'bg-rose-50 text-rose-900 border-rose-200', impact: 'System failure' },
]

interface FaultConfigPanelProps {
  config: FaultConfig[]
  onConfigChange: (config: FaultConfig[]) => void
  availableModules: string[]
}

export function FaultConfigPanel({
  config,
  onConfigChange,
  availableModules,
}: FaultConfigPanelProps) {
  const [previewMode, setPreviewMode] = useState(false)

  const handleAddFault = (faultType: string) => {
    const newFault: FaultConfig = {
      type: faultType,
      severity: 'medium',
      probability: 0.5,
      targetModule: availableModules.length > 0 ? availableModules[0] : undefined,
    }
    onConfigChange([...config, newFault])
  }

  const handleUpdateFault = (index: number, updates: Partial<FaultConfig>) => {
    const updated = [...config]
    updated[index] = { ...updated[index], ...updates }
    onConfigChange(updated)
  }

  const handleRemoveFault = (index: number) => {
    onConfigChange(config.filter((_, i) => i !== index))
  }

  const getFaultTypeInfo = (type: string) => {
    return FAULT_TYPES.find((f) => f.id === type) || FAULT_TYPES[0]
  }

  const getSeverityInfo = (severity: FaultConfig['severity']) => {
    return SEVERITY_LEVELS.find((s) => s.value === severity) || SEVERITY_LEVELS[0]
  }

  const calculateImpact = (fault: FaultConfig) => {
    const severityMultiplier = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    }
    return fault.probability * severityMultiplier[fault.severity]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fault Injection Configuration</CardTitle>
              <CardDescription>
                Configure fault types and severity levels to inject into simulation runs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="preview-mode" className="text-sm">Preview Mode</Label>
              <Switch
                id="preview-mode"
                checked={previewMode}
                onCheckedChange={setPreviewMode}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Fault Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Add Fault Type</CardTitle>
          <CardDescription>Select a fault type to inject into the simulation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FAULT_TYPES.map((faultType) => {
              const Icon = faultType.icon
              return (
                <Button
                  key={faultType.id}
                  variant="outline"
                  className="h-auto flex-col items-start p-4"
                  onClick={() => handleAddFault(faultType.id)}
                  disabled={availableModules.length === 0}
                >
                  <Icon className="h-5 w-5 mb-2 text-muted-foreground" />
                  <div className="font-semibold text-sm">{faultType.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 text-left">
                    {faultType.description}
                  </div>
                </Button>
              )
            })}
          </div>
          {availableModules.length === 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  No modules available. Please select a scenario first.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configured Faults */}
      {config.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configured Faults ({config.length})</CardTitle>
            <CardDescription>
              Configure severity, probability, and target modules for each fault
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.map((fault, index) => {
              const faultTypeInfo = getFaultTypeInfo(fault.type)
              const severityInfo = getSeverityInfo(fault.severity)
              const Icon = faultTypeInfo.icon
              const impact = calculateImpact(fault)

              return (
                <div
                  key={index}
                  className={cn(
                    'p-4 border rounded-lg space-y-4',
                    previewMode && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">{faultTypeInfo.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {faultTypeInfo.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('border', severityInfo.color)}>
                        {severityInfo.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFault(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">Severity</Label>
                      <Select
                        value={fault.severity}
                        onValueChange={(value: FaultConfig['severity']) =>
                          handleUpdateFault(index, { severity: value })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              <div className="flex items-center gap-2">
                                <span>{level.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({level.impact})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Probability (0-1)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={fault.probability}
                        onChange={(e) =>
                          handleUpdateFault(index, {
                            probability: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-9"
                      />
                    </div>

                    {availableModules.length > 0 && (
                      <div>
                        <Label className="text-xs">Target Module</Label>
                        <Select
                          value={fault.targetModule || ''}
                          onValueChange={(value) =>
                            handleUpdateFault(index, { targetModule: value })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All modules" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All modules</SelectItem>
                            {availableModules.map((module) => (
                              <SelectItem key={module} value={module}>
                                {module}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {fault.type === 'latency' && (
                      <div>
                        <Label className="text-xs">Duration (ms)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={fault.duration || 1000}
                          onChange={(e) =>
                            handleUpdateFault(index, {
                              duration: parseInt(e.target.value) || 1000,
                            })
                          }
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>

                  {/* Impact Preview */}
                  {previewMode && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Estimated Impact</span>
                        <span className="font-semibold">{(impact * 100).toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            impact < 0.3
                              ? 'bg-blue-500'
                              : impact < 0.6
                                ? 'bg-amber-500'
                                : impact < 0.9
                                  ? 'bg-orange-500'
                                  : 'bg-rose-500'
                          )}
                          style={{ width: `${impact * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {impact < 0.3
                          ? 'Low impact: Minimal disruption expected'
                          : impact < 0.6
                            ? 'Medium impact: Some degradation expected'
                            : impact < 0.9
                              ? 'High impact: Significant degradation expected'
                              : 'Critical impact: System failure likely'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {config.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fault Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Faults</p>
                <p className="text-2xl font-bold">{config.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-rose-600">
                  {config.filter((f) => f.severity === 'critical').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-orange-600">
                  {config.filter((f) => f.severity === 'high').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Probability</p>
                <p className="text-2xl font-bold">
                  {((config.reduce((sum, f) => sum + f.probability, 0) / config.length) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {config.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Faults Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add fault types above to inject failures into your simulation runs
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

